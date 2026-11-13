import React from "react";
import RenderBuilderContent from "../../../../components/RenderBuilderContent";

// Builder.io editor entry for editing symbols. Rendering an empty
// <Content model="symbol"> lets the editor create/edit symbol content.
export default function SymbolEditorPage() {
  return (
    <RenderBuilderContent content={null} model="symbol" locale="Default" />
  );
}
