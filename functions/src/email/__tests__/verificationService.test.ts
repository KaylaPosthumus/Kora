import { describe, it, expect, beforeEach } from "vitest";

import {
  confirmVerification,
  requestVerification,
  type AccountSummary,
  type VerificationBackend,
} from "../verificationService";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  hashCode,
  type Challenge,
} from "../verificationCode";
import type { MailDocument } from "../mail";

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

const fakeBackend = () => {
  const accounts = new Map<string, AccountSummary>();
  const challenges = new Map<string, Challenge>();
  const mail: MailDocument[] = [];
  const calls: string[] = [];

  const backend: VerificationBackend = {
    readAccount: async (uid) => accounts.get(uid),
    readChallenge: async (uid) => challenges.get(uid),
    writeChallenge: async (uid, challenge) => {
      calls.push("writeChallenge");
      challenges.set(uid, challenge);
    },
    deleteChallenge: async (uid) => {
      calls.push("deleteChallenge");
      challenges.delete(uid);
    },
    recordAttempts: async (uid, attempts) => {
      calls.push("recordAttempts");
      const existing = challenges.get(uid);
      if (existing) challenges.set(uid, { ...existing, attempts });
    },
    markVerified: async (uid) => {
      calls.push("markVerified");
      const account = accounts.get(uid);
      if (account) accounts.set(uid, { ...account, emailVerified: true });
    },
    enqueueMail: async (document) => {
      calls.push("enqueueMail");
      mail.push(document);
    },
  };

  return {
    backend,
    accounts,
    challenges,
    mail,
    calls,
    addAccount: (uid: string, account: Partial<AccountSummary> = {}) =>
      accounts.set(uid, {
        email: "employee@kora.test",
        displayName: "Sam Employee",
        emailVerified: false,
        ...account,
      }),
    /** The code from the most recently queued verification email. */
    lastCode: () => mail.at(-1)?.message.subject.match(/\b(\d{6})\b/)?.[1],
  };
};

describe("requestVerification", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("stores a challenge and queues an email", async () => {
    fake.addAccount("uid1");

    const outcome = await requestVerification("uid1", fake.backend, NOW);

    expect(outcome).toEqual({ status: "sent", expiresInSeconds: CODE_TTL_MS / 1000 });
    expect(fake.challenges.has("uid1")).toBe(true);
    expect(fake.mail).toHaveLength(1);
  });

  it("emails the account's own address", async () => {
    fake.addAccount("uid1", { email: "someone@kora.test" });

    await requestVerification("uid1", fake.backend, NOW);

    expect(fake.mail[0].to).toEqual(["someone@kora.test"]);
  });

  it("queues a code that matches the stored hash", async () => {
    fake.addAccount("uid1");

    await requestVerification("uid1", fake.backend, NOW);

    const code = fake.lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(fake.challenges.get("uid1")!.codeHash).toBe(hashCode("uid1", code!));
  });

  // A code in the user's inbox that was never persisted is unverifiable. The
  // other order — stored but unsent — is merely a resend away.
  it("persists the challenge before queueing the mail", async () => {
    fake.addAccount("uid1");

    await requestVerification("uid1", fake.backend, NOW);

    expect(fake.calls).toEqual(["writeChallenge", "enqueueMail"]);
  });

  it("does nothing for an already-verified address", async () => {
    fake.addAccount("uid1", { emailVerified: true });

    const outcome = await requestVerification("uid1", fake.backend, NOW);

    expect(outcome).toEqual({ status: "already-verified" });
    expect(fake.mail).toEqual([]);
  });

  it("reports no-account when there is no auth user", async () => {
    expect(await requestVerification("ghost", fake.backend, NOW)).toEqual({
      status: "no-account",
    });
  });

  // A Google sign-in can leave an account without an email address.
  it("reports no-email rather than queueing mail to nowhere", async () => {
    fake.addAccount("uid1", { email: undefined });

    const outcome = await requestVerification("uid1", fake.backend, NOW);

    expect(outcome).toEqual({ status: "no-email" });
    expect(fake.mail).toEqual([]);
  });

  it("throttles a resend inside the cooldown and says how long to wait", async () => {
    fake.addAccount("uid1");
    await requestVerification("uid1", fake.backend, NOW);

    const outcome = await requestVerification("uid1", fake.backend, NOW + 15_000);

    expect(outcome).toEqual({ status: "cooldown", retryAfterSeconds: 45 });
    expect(fake.mail).toHaveLength(1);
  });

  it("allows a resend once the cooldown has elapsed", async () => {
    fake.addAccount("uid1");
    await requestVerification("uid1", fake.backend, NOW);

    const outcome = await requestVerification(
      "uid1",
      fake.backend,
      NOW + RESEND_COOLDOWN_MS
    );

    expect(outcome.status).toBe("sent");
    expect(fake.mail).toHaveLength(2);
  });

  it("issues a different code on resend and invalidates the first", async () => {
    fake.addAccount("uid1");
    await requestVerification("uid1", fake.backend, NOW);
    const firstCode = fake.lastCode()!;

    await requestVerification("uid1", fake.backend, NOW + RESEND_COOLDOWN_MS);

    const outcome = await confirmVerification(
      "uid1",
      firstCode,
      fake.backend,
      NOW + RESEND_COOLDOWN_MS
    );
    expect(outcome.status).not.toBe("verified");
  });
});

describe("confirmVerification", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  /** Requests a code and hands back the plaintext, as the user's inbox would. */
  const issue = async (uid = "uid1") => {
    await requestVerification(uid, fake.backend, NOW);
    return fake.lastCode()!;
  };

  it("verifies the account when the code matches", async () => {
    fake.addAccount("uid1");
    const code = await issue();

    const outcome = await confirmVerification("uid1", code, fake.backend, NOW + 1000);

    expect(outcome).toEqual({ status: "verified" });
    expect(fake.accounts.get("uid1")!.emailVerified).toBe(true);
  });

  // Consuming the challenge is what stops a code being replayed.
  it("consumes the challenge on success", async () => {
    fake.addAccount("uid1");
    const code = await issue();

    await confirmVerification("uid1", code, fake.backend, NOW);

    expect(fake.challenges.has("uid1")).toBe(false);
  });

  it("refuses to reuse a code that already verified the account", async () => {
    fake.addAccount("uid1");
    const code = await issue();
    await confirmVerification("uid1", code, fake.backend, NOW);

    const second = await confirmVerification("uid1", code, fake.backend, NOW);

    expect(second).toEqual({ status: "already-verified" });
  });

  it("reports a wrong code with the attempts left", async () => {
    fake.addAccount("uid1");
    const code = await issue();
    const wrong = code === "000000" ? "111111" : "000000";

    const outcome = await confirmVerification("uid1", wrong, fake.backend, NOW);

    expect(outcome).toEqual({ status: "wrong-code", attemptsRemaining: MAX_ATTEMPTS - 1 });
    expect(fake.accounts.get("uid1")!.emailVerified).toBe(false);
  });

  // Persisting the bump is what stops the budget being evaded by abandoning
  // each request partway through.
  it("persists a spent attempt", async () => {
    fake.addAccount("uid1");
    const code = await issue();
    const wrong = code === "000000" ? "111111" : "000000";

    await confirmVerification("uid1", wrong, fake.backend, NOW);

    expect(fake.challenges.get("uid1")!.attempts).toBe(1);
  });

  it("locks the code after the attempt budget is spent", async () => {
    fake.addAccount("uid1");
    const code = await issue();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await confirmVerification("uid1", wrong, fake.backend, NOW);
    }

    // The correct code no longer helps.
    expect(await confirmVerification("uid1", code, fake.backend, NOW)).toEqual({
      status: "too-many-attempts",
    });
    expect(fake.accounts.get("uid1")!.emailVerified).toBe(false);
  });

  it("refuses an expired code", async () => {
    fake.addAccount("uid1");
    const code = await issue();

    const outcome = await confirmVerification(
      "uid1",
      code,
      fake.backend,
      NOW + CODE_TTL_MS
    );

    expect(outcome).toEqual({ status: "expired" });
    expect(fake.accounts.get("uid1")!.emailVerified).toBe(false);
  });

  it("reports no-challenge when none was issued", async () => {
    fake.addAccount("uid1");

    expect(await confirmVerification("uid1", "123456", fake.backend, NOW)).toEqual({
      status: "no-challenge",
    });
  });

  it("reports no-account for an unknown uid", async () => {
    expect(await confirmVerification("ghost", "123456", fake.backend, NOW)).toEqual({
      status: "no-account",
    });
  });

  // A broken input mask should not be able to lock a user out of their code.
  it("does not spend an attempt on a malformed submission", async () => {
    fake.addAccount("uid1");
    await issue();

    const outcome = await confirmVerification("uid1", "abc", fake.backend, NOW);

    expect(outcome).toEqual({ status: "malformed" });
    expect(fake.challenges.get("uid1")!.attempts).toBe(0);
  });

  it("clears a stale challenge when the account is already verified", async () => {
    fake.addAccount("uid1");
    await issue();
    fake.accounts.set("uid1", { ...fake.accounts.get("uid1")!, emailVerified: true });

    await confirmVerification("uid1", "123456", fake.backend, NOW);

    expect(fake.challenges.has("uid1")).toBe(false);
  });

  it("does not let one user's code verify another account", async () => {
    fake.addAccount("uid1");
    fake.addAccount("uid2");
    const code = await issue("uid1");
    await requestVerification("uid2", fake.backend, NOW);

    const outcome = await confirmVerification("uid2", code, fake.backend, NOW);

    expect(outcome.status).not.toBe("verified");
    expect(fake.accounts.get("uid2")!.emailVerified).toBe(false);
  });
});
