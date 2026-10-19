import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./assets/main.css";
import { vHorizontalScroll } from "./directives/horizontalScroll";

const app = createApp(App);
app.use(createPinia());
app.directive("horizontal-scroll", vHorizontalScroll);
app.mount("#app");

