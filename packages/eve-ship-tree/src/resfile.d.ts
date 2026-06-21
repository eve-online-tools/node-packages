/// <reference types="@eve-online-tools/eve-resfile/client" />

declare module "*.css";
declare module "*.module.scss" {
  const classes: Record<string, string>;
  export default classes;
}
