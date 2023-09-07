declare module 'acorn-static-class-features' {
  import acorn from 'acorn';

  const staticClassFeatures: (BaseParser: typeof acorn.Parser) => typeof acorn.Parser;

  namespace staticClassFeatures {
    type AcornStaticClassFeaturesParser = acorn.Parser
  }

  export = staticClassFeatures;
}
