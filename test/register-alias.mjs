import { register } from "node:module";

register("./alias-hooks.mjs", {
  parentURL: import.meta.url,
  data: { root: new URL("../", import.meta.url).href },
});
