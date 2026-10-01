// AdminUserDTO in backend

export interface AdminUser {
  adminId: string;
  userId: string;
  email: string | null;
  fullName: string | null;
}