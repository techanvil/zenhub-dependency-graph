# Zenhub Dependency Graph

https://techanvil.github.io/zenhub-dependency-graph/

For the ZDG integration with Gemini, see https://github.com/techanvil/chrysalis/

---

# Getting Started

This project is built with [Vite](https://vitejs.dev/) and React, providing fast development and optimized production builds.

## Prerequisites

- Node.js (version 22 or higher)
- npm

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in development mode with hot module replacement.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload automatically when you make edits.\
You will also see any lint errors in the console.

This command also runs GraphQL code generation in watch mode to automatically update generated types when the schema changes.

### `npm run build`

Builds the app for production to the `build` folder.\
The build is optimized for the best performance with minification and tree-shaking.

The build is minified and the filenames include content hashes for optimal caching.\
Your app is ready to be deployed!

### `npm run preview`

Serves the production build locally for testing.\
This allows you to test the production build before deploying.

### `npm run generate`

Generates TypeScript types from the GraphQL schema.\
This command is automatically run before development and build.

### `npm run lint:js-fix`

Formats JavaScript and TypeScript files using Prettier.\
This helps maintain consistent code style across the project.

## Development

The project uses:

- **Vite** for fast development and building
- **React 18** with TypeScript
- **GraphQL** with code generation for type safety
- **Chakra UI** for component styling
- **D3.js** for data visualization
- **Jotai** for state management

## Learn More

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://reactjs.org/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)
