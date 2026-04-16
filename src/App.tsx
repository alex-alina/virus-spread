import "./App.css";
import { VirusSpread } from "./game/VirusSpread";
import Logo from "./assets/Logo-small.png";

function App() {
  return (
    <div className="min-h-dvh w-full bg-blue-950">
      <div className="flex w-full py-6 pl-10">
        <img src={Logo} className="w-40"></img>
      </div>
      <VirusSpread />
    </div>
  );
}

export default App;
