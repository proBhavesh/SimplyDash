# Dockerfile Running `server.js` Instead of `server.ts`

**Issue**:
The Dockerfile is running `dist/server.js` instead of `server.ts`, causing confusion about why the compiled JavaScript file is executed instead of the TypeScript source file.

**Cause**:
- During the Docker build process, TypeScript files (`.ts`) are compiled into JavaScript files (`.js`) using the `RUN npx tsc` command.
- The compiled JavaScript files are output to the `dist` directory.
- In the production stage of the Dockerfile, the application runs the compiled `server.js` file for performance and reliability reasons.

**Solution**:
- Continue running `dist/server.js` in the production environment to ensure optimal performance.
- If you need to run `server.ts` directly for development purposes, consider modifying the Dockerfile to use `ts-node` or run the development environment outside of Docker.

**Recommendations**:
- Verify that your `tsconfig.json` is correctly set up to compile TypeScript files into the `dist` directory.
- Ensure that all necessary TypeScript files are included in the compilation step.
- Update documentation if needed to reflect the build and run process.

**Notes**:
Running the compiled JavaScript file avoids runtime overhead and potential errors from on-the-fly TypeScript compilation. This practice leads to better performance and stability in production environments.
