# Prism Music Player - Release Guide

This guide follows industry standards for software releases. It ensures a consistent, high-quality deployment process while minimizing human error and security risks.

## 1. Pre-Release Planning
Before starting the release process, ensure alignment.
- **Goals & Metrics**: Identify the purpose of the release (e.g., new features, bug fixes).
- **Rollback Plan**: Have a contingency plan in case a critical bug is discovered post-release (e.g., pulling the release or deploying a hotfix).

## 2. Development & Testing
Ensure the code is stable, secure, and meets quality standards before packaging.

- **Run Frontend Tests & Linter**: Make sure the UI code has no errors.
  ```bash
  npm run lint
  npm test
  ```
- **Run Backend Tests & Linter**: Check the Rust audio engine and commands.
  ```bash
  cd src-tauri
  cargo clippy -- -D warnings
  cargo test
  cd ..
  ```
- **Secret Scanning & Security**: Check for accidentally committed passwords, API keys, or sensitive tokens before releasing.
  Use automated tools or a regex search to double-check the codebase.
  *Example regex search for common secrets*:
  ```bash
  git grep -i -E "(api_key|password|secret|token).*=" 
  ```
- **Manual QA**: Open the app and do a sanity check of core features (playing music, library scan, lyrics).

## 3. Release Preparation
Finalize the environment and materials needed for the launch.

- **Update Version Numbers**: Match the new version (e.g., `1.2.0`).
  - Update `version` in `package.json`.
  - Update `version` in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
- **Update Documentation**:
  - Update `README.md` with new features or updated screenshots.
  - Update `docs/ARCHITECTURE.md` if any core pipelines or store states changed.
- **Build the App**: Create the executable files (`.msi` or `.exe`).
  ```bash
  npm run tauri build
  ```

## 4. Release Execution
Deploy the release to GitHub so users can download it.

1. **Push Changes**: Commit all version and doc updates to `main`.
   ```bash
   git add .
   git commit -m "chore: prep release vX.X.X"
   git push origin main
   ```
2. **Draft a New Release**: Go to GitHub -> Releases -> "Draft a new release".
3. **Set Tag**: Create a new tag matching the version (e.g., `vX.X.X`).
4. **Release Notes**: Write a concise and simple message.
   
   **Format Example:**
   ```markdown
   ## What's New
   - **Feature Name**: Simple explanation of what it does.
   
   ## Fixes
   - **Bug Name**: Simple explanation of what was fixed.
   
   ## Under the Hood
   - Minor performance tweaks or cleanups.
   ```
5. **Attach Binaries**: Upload the files generated in `src-tauri/target/release/bundle/`.
6. **Publish**: Click "Publish release".

## 5. Post-Release Validation & Cleanup
The work continues after the code is live.

- **Post-Release Sanity Check**: Download the released binary from GitHub and ensure it installs and runs correctly in a production environment.
- **Monitor Feedback**: Watch for bug reports or issues from users.
- **Cleanup Locally**: 
  - Close resolved issues or pull requests on GitHub.
  - Clean up build artifacts if needed (`cargo clean` inside `src-tauri`).
