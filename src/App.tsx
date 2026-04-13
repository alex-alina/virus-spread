import { useState } from "react";
import hamster from "./assets/hamster.jpg";
import "./App.css";
import clsx from "clsx";

function App() {
  const [count, setCount] = useState(0);
  const isEven = count % 2 === 0;
  return (
    <>
      <div className="flex justify-center">
        <a href="https://en.wikipedia.org/wiki/Hamster" target="_blank">
          <img
            src={hamster}
            className="h-80 w-80 rounded-full"
            alt="cute hamster cartoon smiling"
          />
        </a>
      </div>
      <h1 className="my-4 text-3xl font-bold underline">The Lab</h1>
      <div className="card">
        <button
          className={clsx("mb-4 rounded-2xl px-4 py-1", {
            "bg-emerald-300": isEven,
            "bg-cyan-800 text-white": !isEven,
          })}
          onClick={() => setCount((count) => count + 1)}
        >
          Seeds count is {count}
        </button>
        <p>Click to give the hamster more seeds.</p>
      </div>
    </>
  );
}

export default App;
