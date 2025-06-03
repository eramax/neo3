# Coding Guidelines

## General Principles

- Use JavaScript exclusively - no TypeScript or type annotations
- Prioritize concise, minimal code - fewer lines are better
- Optimize for performance in all implementations
- Always update backlog.md in root directory with any changes made
- No shadow components
- Always add your styles to src/app.scss
- Use ES6+ features for modern JavaScript practices
- use only dark mode colors for UI elements
- always use bun and not npm
- Use window path for all file paths e.g, /g/file.txt

## JavaScript Specific Rules

- Use arrow functions instead of function declarations when possible
- Prefer const/let over var
- Use destructuring for object/array access
- Leverage built-in array methods (map, filter, reduce) over loops
- Use template literals instead of string concatenation
- Prefer ternary operators over if/else for simple conditions

## Performance Optimization

- Use efficient algorithms and data structures
- Minimize DOM manipulations - batch operations when possible
- Prefer native JavaScript methods over external libraries
- Cache frequently accessed elements and values
- Use event delegation instead of multiple event listeners
- Implement lazy loading where applicable

## Code Style

- Use single-letter variables for short-lived iterators (i, j, k)
- Combine operations in single statements when readable
- Remove unnecessary brackets and semicolons where optional
- Use short, descriptive variable names

## Documentation Requirements

- No inline comments unless absolutely necessary for complex logic
- Update backlog.md with:
  - What was the requirements for the change

## Example Patterns

```javascript
// Preferred: Short and optimized
const users = data.filter((u) => u.active).map((u) => u.name);

// Avoid: Verbose and slow
let activeUsers = [];
for (let i = 0; i < data.length; i++) {
  if (data[i].active === true) {
    activeUsers.push(data[i].name);
  }
}
```

## Example Backlog Entry

- Always add entries to backlog.md in this format:
- no dates or version numbers just the feature or fix description apeand to the end of the file

```md
- User wants to [describe the feature or fix]
```
