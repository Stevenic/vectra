# Contribution Guidelines

## 1. Introduction

Thank you for your interest in contributing to Vectra! This project is an open-source local vector database for Node.js, licensed under the MIT License. These guidelines are intended to help you understand how to contribute effectively, maintain code quality, and foster a welcoming and productive community. Please read them carefully before making contributions.

## 2. Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the standards of behavior expected in this community.

## 3. How to Contribute

### Reporting Bugs

- If you find a bug, please [open an issue](https://github.com/Stevenic/vectra/issues) and provide as much detail as possible, including steps to reproduce, expected behavior, and your environment (Node.js version, OS, etc.).

### Suggesting Enhancements

- To suggest a new feature or enhancement, [open an issue](https://github.com/Stevenic/vectra/issues) and describe your idea clearly. Include your use case and any relevant examples.

### Submitting Pull Requests

- Fork the repository and create your branch from `main`.
- Make your changes in a logical, self-contained commit.
- Ensure your code follows the project’s coding standards and passes all tests.
- Submit a pull request (PR) with a clear description of your changes and reference any related issues.

## 4. Development Setup

### Prerequisites

- **Node.js**: Version 20.x or higher is required.
- **Package Manager**: [Yarn](https://classic.yarnpkg.com/en/docs/install/) is recommended (see `packageManager` in `package.json`).

### Installation Steps

1. **Clone the repository:**
    ```sh
    git clone https://github.com/Stevenic/vectra.git
    cd vectra
    ```

2. **Install dependencies:**
    ```sh
    yarn install
    ```

### Running Tests and Linting

- **Build the project:**
    ```sh
    yarn build
    ```

- **Run tests:**
    ```sh
    yarn test
    ```

- **Run linter and auto-fix issues:**
    ```sh
    yarn lint
    ```

## 5. Coding Standards

### Code Style and Formatting

- Use consistent code style as enforced by the linter (`yarn lint`).
- Prefer TypeScript for all source files.
- Follow the existing file and folder structure in the `src/` directory.

### Commit Message Guidelines

- Write clear, concise commit messages.
- Use the present tense (“Add feature” not “Added feature”).
- Reference issues or PRs when relevant (e.g., `Fix #123: Correct vector normalization`).

### File and Folder Structure

- Place all source code in the `src/` directory.
- Tests should be placed alongside source files as a `*.spec.ts` file.
- Keep documentation and configuration files in the project root or as specified by existing structure.

## 6. Pull Request Process

### Branching Model

- Create a feature or fix branch from `main` (e.g., `feature/add-metadata-filter` or `fix/vector-similarity-bug`).
- Keep your branch focused on a single topic or issue.

### How to Submit a Pull Request

1. Push your branch to your forked repository.
2. Open a pull request (PR) against the `main` branch of the upstream repository.
3. Provide a clear and descriptive title and summary for your PR.
4. Reference any related issues by number (e.g., `Closes #45`).

### Review Process

- All PRs will be reviewed by maintainers or other contributors.
- Address any requested changes and update your PR as needed.
- PRs must pass all tests and linting checks before being merged.
- Once approved, a maintainer will merge your PR.

## 7. Testing

### How to Run Tests

- To run the full test suite, use:
    ```sh
    yarn test
    ```
- This will build the project and run all tests using Mocha and NYC for coverage.

### Writing New Tests

- Add new tests for any new features or bug fixes.
- Place test files alongside the relevant source files or in the `src/` directory with a `.spec.ts` suffix.
- Use [Mocha](https://mochajs.org/) and [Sinon](https://sinonjs.org/) for writing and mocking in tests.
- Ensure all tests pass before submitting a pull request.

## 8. Documentation

### Updating/Adding Documentation

- Update the `README.md` or other relevant documentation files when you add features or make changes.
- Ensure that usage examples and API references are clear and accurate.

### Generating API Docs

- API documentation can be generated using [TypeDoc](https://typedoc.org/).
- To generate docs, run:
    ```sh
    yarn build-docs
    ```
- Generated documentation will be output as specified in the `build-docs` script in `package.json`.

## 9. License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE). Please ensure that you have the right to submit your code and that it does not violate any third-party licenses or agreements.

## 10. Contact

If you have questions, need help, or want to discuss ideas, please open an issue on [GitHub](https://github.com/Stevenic/vectra/issues). For sensitive matters, you may contact the maintainer at ickman@gmail.com.

## 11. Acknowledgements

- Vectra is inspired by other vector databases such as [Pinecone](https://www.pinecone.io/) and [Qdrant](https://qdrant.tech/).
- Portions of this project and its documentation may reuse or adapt content and tools from the open-source community. See individual files for additional attributions where applicable.