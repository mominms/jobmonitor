# Codebase Integrity Verification Skill

## Overview
This document provides a systematic approach to verify the integrity, consistency, and logical soundness of your complete codebase. Use this as a checklist to ensure your project is properly streamlined and all logic is functioning correctly.

---

## 1. Project Structure & Organization

### Directory Structure Validation
- [ ] Verify consistent folder naming conventions (kebab-case, camelCase, or snake_case)
- [ ] Ensure logical separation of concerns (components, services, utilities, models)
- [ ] Check for orphaned or unused directories
- [ ] Validate that configuration files are in appropriate locations
- [ ] Confirm assets, static files, and resources are properly organized

### File Organization
- [ ] Check that file names match their exported classes/functions
- [ ] Verify consistent file naming patterns across the project
- [ ] Ensure no duplicate file names in different directories (unless intentional)
- [ ] Validate that index files properly export modules
- [ ] Check for abandoned or commented-out files

---

## 2. Code Quality & Standards

### Linting & Formatting
```bash
# Run your linter
npm run lint
# or
eslint . --ext .js,.jsx,.ts,.tsx

# Check formatting
prettier --check "**/*.{js,jsx,ts,tsx,json,css,md}"
```

- [ ] All files pass linting without errors
- [ ] Consistent code formatting across the entire codebase
- [ ] No disabled linting rules without justification
- [ ] ESLint/TSLint configuration is up to date

### Code Standards Checklist
- [ ] Consistent indentation (2 spaces, 4 spaces, or tabs)
- [ ] Proper use of semicolons (consistent with project style)
- [ ] Consistent quote style (single vs double quotes)
- [ ] Proper line length limits enforced
- [ ] No trailing whitespace
- [ ] Files end with a newline

---

## 3. Dependencies & Imports

### Package Management
```bash
# Check for outdated packages
npm outdated

# Check for security vulnerabilities
npm audit

# Verify no missing dependencies
npm install --dry-run
```

- [ ] All dependencies in package.json are actually used
- [ ] No unused dependencies (run `depcheck` or similar)
- [ ] Dependencies are pinned to specific versions or safe ranges
- [ ] No security vulnerabilities in dependencies
- [ ] DevDependencies and dependencies are correctly categorized

### Import Analysis
- [ ] No circular dependencies between modules
- [ ] All imports resolve correctly
- [ ] No unused imports in any file
- [ ] Import paths are consistent (absolute vs relative)
- [ ] Barrel exports (index files) are used appropriately
- [ ] No duplicate imports in the same file

---

## 4. Type Safety & Validation

### TypeScript Projects
```bash
# Type checking
npx tsc --noEmit

# Check for any types
npx tsc --noEmit --strict
```

- [ ] No TypeScript errors
- [ ] No use of `any` type (or justified exceptions documented)
- [ ] All function parameters and return types are explicitly typed
- [ ] Interfaces and types are properly defined
- [ ] Enums are used where appropriate
- [ ] Generic types are used correctly

### JavaScript Projects
- [ ] JSDoc comments for complex functions
- [ ] PropTypes defined for React components (if applicable)
- [ ] Input validation for critical functions
- [ ] Type coercion is explicit and intentional

---

## 5. Logic & Business Rules

### Function & Method Validation
- [ ] All functions have a single, clear responsibility
- [ ] Function names accurately describe what they do
- [ ] No overly complex functions (cyclomatic complexity < 10)
- [ ] Edge cases are handled appropriately
- [ ] Error conditions are properly managed
- [ ] No unreachable code
- [ ] No infinite loops or recursion without base cases

### Control Flow Analysis
- [ ] All if/else branches are necessary
- [ ] Switch statements have default cases
- [ ] No duplicate conditional checks
- [ ] Boolean logic is simplified where possible
- [ ] Early returns are used to reduce nesting

### Data Flow Integrity
- [ ] State mutations are intentional and tracked
- [ ] No unintended side effects in pure functions
- [ ] Data transformations maintain type consistency
- [ ] Immutability patterns are followed where required
- [ ] No data leaks or unexpected data exposure

---

## 6. Testing Coverage

### Test Execution
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suites
npm test -- --testPathPattern=<pattern>
```

### Test Quality Checklist
- [ ] All critical business logic has unit tests
- [ ] Test coverage meets project standards (typically 80%+)
- [ ] Edge cases are tested
- [ ] Error scenarios are tested
- [ ] Integration tests cover main user flows
- [ ] No skipped or disabled tests without documented reasons
- [ ] Tests are independent and can run in any order
- [ ] Mock data is realistic and comprehensive

---

## 7. API & Interface Contracts

### API Consistency
- [ ] All API endpoints follow RESTful conventions (if REST)
- [ ] Request/response schemas are documented
- [ ] Error responses follow consistent format
- [ ] API versioning is properly implemented
- [ ] Rate limiting and throttling are in place
- [ ] Authentication/authorization checks are consistent

### Component Interfaces
- [ ] Component props are properly typed
- [ ] Required vs optional props are clearly defined
- [ ] Prop defaults are sensible
- [ ] Event handlers follow naming conventions
- [ ] Component APIs are consistent across similar components

---

## 8. Error Handling & Logging

### Error Management
- [ ] All async operations have error handlers
- [ ] Errors are logged appropriately
- [ ] User-facing error messages are clear and helpful
- [ ] Critical errors trigger appropriate alerts
- [ ] Error boundaries are implemented (React)
- [ ] No swallowed errors (empty catch blocks)
- [ ] Stack traces are preserved

### Logging Standards
- [ ] Consistent logging levels (debug, info, warn, error)
- [ ] No console.log in production code
- [ ] Sensitive data is not logged
- [ ] Logs provide sufficient context for debugging

---

## 9. Performance & Optimization

### Performance Checks
```bash
# Bundle size analysis
npm run build -- --analyze

# Performance profiling (if available)
npm run perf
```

- [ ] No memory leaks detected
- [ ] Event listeners are properly cleaned up
- [ ] Large lists use virtualization
- [ ] Images are optimized and lazy-loaded
- [ ] Code splitting is implemented where beneficial
- [ ] Database queries are optimized
- [ ] No N+1 query problems

### Resource Management
- [ ] File handles are properly closed
- [ ] Database connections are pooled
- [ ] Timers and intervals are cleared
- [ ] Subscriptions are unsubscribed
- [ ] Cache invalidation logic is correct

---

## 10. Security Verification

### Security Checklist
- [ ] No hardcoded credentials or API keys
- [ ] Environment variables are used for sensitive data
- [ ] Input sanitization is implemented
- [ ] SQL injection prevention measures in place
- [ ] XSS protection implemented
- [ ] CSRF protection enabled
- [ ] Authentication tokens are securely stored
- [ ] Access control is enforced at all layers
- [ ] Dependencies have no known vulnerabilities

---

## 11. Documentation & Comments

### Code Documentation
- [ ] Complex algorithms are explained
- [ ] TODOs are tracked and assigned
- [ ] Deprecated code is marked clearly
- [ ] Public APIs have JSDoc/TypeDoc comments
- [ ] README files exist for major modules
- [ ] Architecture decisions are documented

### Comment Quality
- [ ] Comments explain "why" not "what"
- [ ] No commented-out code (use version control instead)
- [ ] Comments are up-to-date with code changes
- [ ] No misleading or outdated comments

---

## 12. Build & Deployment

### Build Verification
```bash
# Clean build
rm -rf dist/ build/
npm run build

# Check build output
ls -lh dist/
```

- [ ] Project builds without errors
- [ ] Build output is optimized (minified, tree-shaken)
- [ ] Source maps are generated for debugging
- [ ] Environment-specific builds work correctly
- [ ] No build warnings that should be errors

### Configuration Validation
- [ ] Environment variables are documented
- [ ] All required configs are present
- [ ] Config validation happens at startup
- [ ] Secrets are not committed to version control
- [ ] CI/CD pipelines pass all checks

---

## 13. Version Control

### Git Hygiene
```bash
# Check for large files
git ls-files | xargs ls -lh | sort -k5 -h -r | head -20

# Check for sensitive data
git log --all --full-history --source -- **/*.env
```

- [ ] .gitignore is comprehensive
- [ ] No large binary files in repository
- [ ] No sensitive data in commit history
- [ ] Commit messages are clear and descriptive
- [ ] Branches follow naming conventions
- [ ] No merge conflicts or unresolved markers

---

## 14. Cross-Cutting Concerns

### Consistency Checks
- [ ] Naming conventions are consistent throughout
- [ ] Date/time handling is consistent
- [ ] Currency/number formatting is consistent
- [ ] Timezone handling is correct
- [ ] Internationalization is properly implemented
- [ ] Accessibility standards are met

### Integration Points
- [ ] Third-party service integrations have fallbacks
- [ ] API rate limits are respected
- [ ] Webhooks are properly secured
- [ ] External dependencies have health checks

---

## Automated Verification Script

Create a script to run all checks:

```bash
#!/bin/bash
# verify-codebase.sh

echo "🔍 Starting Codebase Verification..."

echo "
📦 Checking dependencies..."
npm outdated
npm audit

echo "
🧹 Running linter..."
npm run lint

echo "
🎨 Checking code formatting..."
prettier --check "**/*.{js,jsx,ts,tsx,json,css,md}"

echo "
🔷 Type checking..."
npx tsc --noEmit

echo "
🧪 Running tests..."
npm test -- --coverage

echo "
🏗️  Building project..."
npm run build

echo "
✅ Verification complete!"
```

---

## Quick Verification Checklist

Use this for rapid integrity checks:

- [ ] `npm install` completes without errors
- [ ] `npm run lint` passes
- [ ] `npm test` all tests pass
- [ ] `npm run build` completes successfully
- [ ] No TypeScript/type errors
- [ ] No console errors in browser/runtime
- [ ] All environment variables documented
- [ ] README is up-to-date
- [ ] Dependencies are up-to-date or intentionally pinned
- [ ] No TODO comments older than 30 days without tickets

---

## Tools & Resources

### Recommended Tools
- **Linting**: ESLint, Stylelint
- **Formatting**: Prettier
- **Type Checking**: TypeScript, Flow
- **Testing**: Jest, Vitest, Cypress, Playwright
- **Dependencies**: npm-check-updates, depcheck
- **Security**: npm audit, Snyk, OWASP Dependency-Check
- **Code Quality**: SonarQube, CodeClimate
- **Bundle Analysis**: webpack-bundle-analyzer, source-map-explorer
- **Documentation**: TypeDoc, JSDoc

### Metrics to Track
- Code coverage percentage
- Cyclomatic complexity
- Lines of code (LOC)
- Technical debt ratio
- Build time
- Bundle size
- Test execution time

---

## Continuous Verification

Integrate these checks into your development workflow:

1. **Pre-commit hooks**: Run linting and formatting
2. **Pre-push hooks**: Run tests
3. **CI/CD pipeline**: Full verification on every pull request
4. **Scheduled audits**: Weekly dependency and security checks
5. **Code reviews**: Manual logic and architecture review

---

## Conclusion

Regular verification ensures your codebase remains healthy, maintainable, and reliable. Schedule periodic reviews using this checklist and automate as much as possible to catch issues early.