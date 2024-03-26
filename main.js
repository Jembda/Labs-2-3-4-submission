import "./style.css";
import { setupButton } from "./dm5.js";


document.querySelector("#app").innerHTML = `
  <div>
    <div class="container">
      <button id="myButton" type="button"></button>
    </div>
  </div>
`;

setupButton(document.querySelector("#counter"));

