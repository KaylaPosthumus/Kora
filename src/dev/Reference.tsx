// Import components
import KoraBtn from "@/shared/components/KoraBtn";
import KoraCircleBtn from "@/shared/components/KoraCircleBtn";
import KoraBadge from "@/shared/components/KoraBadge";

// Import Icons
import DeleteIcon from "@mui/icons-material/Delete";
import InsertEmoticonIcon from "@mui/icons-material/InsertEmoticon";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCartRounded";

function ReferencePage() {
  return (
    <div className="max-w-7xl mx-auto m-4">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900">Custom Components Reference</h1>

      {/* KoraBtns */}
      <div>
        <h3 className="text-xl font-bold mb-2">KoraBtn</h3>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <KoraBtn primary style="default">
                Primary Default
              </KoraBtn>
              <KoraBtn primary style="black">
                Primary Black
              </KoraBtn>
              <KoraBtn primary style="red">
                Primary Red with Icon <DeleteIcon />
              </KoraBtn>
              <KoraBtn primary iconOnly>
                <ArrowBackIcon />
              </KoraBtn>
            </div>
            <div className="flex gap-2">
              <KoraBtn secondary>
                <InsertEmoticonIcon /> Secondary Default with Icon
              </KoraBtn>
              <KoraBtn secondary style="black">
                Secondary Black
              </KoraBtn>
              <KoraBtn secondary style="red">
                Secondary Red
              </KoraBtn>
              <KoraCircleBtn icon={<AddIcon />} />
              <KoraCircleBtn style="black" icon={<AddIcon />} />
              <KoraCircleBtn style="red" icon={<AddIcon />} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold mb-2">KoraBadge</h3>
            <div className="flex gap-2">
              <KoraBadge text="Large" size="large" />
              <KoraBadge text="Medium" size="medium" />
              <KoraBadge text="Small" size="small" />
              <KoraBadge text="X-Small" size="x-small" />
              <KoraBadge text="Green" size="small" color="green" />
              <KoraBadge text="Black" size="small" color="black" />
              <KoraBadge text="Yellow" size="small" color="yellow" />
              <KoraBadge text="Red" size="small" color="red" />
              <KoraBadge text="Blue" size="small" color="blue" />
              <KoraBadge text="White" size="small" color="white" />
              <KoraBadge text="Orange" size="small" color="orange" />
            </div>
          </div>
        </div>
      </div>
      <KoraBtn secondary style="red" iconOnly>
        <ShoppingCartIcon />
      </KoraBtn>
    </div>
  );
}

export default ReferencePage;
