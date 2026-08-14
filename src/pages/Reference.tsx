// Import components
import CoriBtn from "../components/buttons/CoriBtn";
import CoriCircleBtn from "../components/buttons/CoriCircleBtn";
import CoriBadge from "../components/badges/CoriBadge";

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

      {/* CoriBtns */}
      <div>
        <h3 className="text-xl font-bold mb-2">CoriBtn</h3>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <CoriBtn primary style="default">
                Primary Default
              </CoriBtn>
              <CoriBtn primary style="black">
                Primary Black
              </CoriBtn>
              <CoriBtn primary style="red">
                Primary Red with Icon <DeleteIcon />
              </CoriBtn>
              <CoriBtn primary iconOnly>
                <ArrowBackIcon />
              </CoriBtn>
            </div>
            <div className="flex gap-2">
              <CoriBtn secondary>
                <InsertEmoticonIcon /> Secondary Default with Icon
              </CoriBtn>
              <CoriBtn secondary style="black">
                Secondary Black
              </CoriBtn>
              <CoriBtn secondary style="red">
                Secondary Red
              </CoriBtn>
              <CoriCircleBtn icon={<AddIcon />} />
              <CoriCircleBtn style="black" icon={<AddIcon />} />
              <CoriCircleBtn style="red" icon={<AddIcon />} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold mb-2">CoriBadge</h3>
            <div className="flex gap-2">
              <CoriBadge text="Large" size="large" />
              <CoriBadge text="Medium" size="medium" />
              <CoriBadge text="Small" size="small" />
              <CoriBadge text="X-Small" size="x-small" />
              <CoriBadge text="Green" size="small" color="green" />
              <CoriBadge text="Black" size="small" color="black" />
              <CoriBadge text="Yellow" size="small" color="yellow" />
              <CoriBadge text="Red" size="small" color="red" />
              <CoriBadge text="Blue" size="small" color="blue" />
              <CoriBadge text="White" size="small" color="white" />
              <CoriBadge text="Orange" size="small" color="orange" />
            </div>
          </div>
        </div>
      </div>
      <CoriBtn secondary style="red" iconOnly>
        <ShoppingCartIcon />
      </CoriBtn>
    </div>
  );
}

export default ReferencePage;
