# Troubleshooting Documentation

This directory contains troubleshooting guides, known issues, and their solutions.

## Quick Links

- 📋 **[Known Issues & Fixes](./known-issues-and-fixes.md)** - Common problems encountered during development and their solutions
- 🛡️ **[Environment Files Protection](./ENV-FILES-PROTECTION.md)** - **CRITICAL**: How AI agents must handle .env files

## When to Use This Documentation

### Before Starting a New Feature
- Review the **Development Checklist** in Known Issues & Fixes
- Check if your feature involves patterns that have caused issues before

### When You Encounter an Error
1. Check if the error matches any in **Known Issues & Fixes**
2. Follow the documented solution
3. If the solution doesn't work, document your findings and add to this guide

### After Fixing a Tricky Bug
1. Document the issue in **Known Issues & Fixes**
2. Add prevention guidelines
3. Update the development checklist if applicable

## Common Error Patterns

| Error | Most Likely Cause | Quick Fix |
|-------|-------------------|-----------|
| `user.role is undefined` | Middleware not passing context | Use `authenticate` directly, check role in handler |
| `process is not defined` | Using Node.js API in browser | Check `typeof window !== "undefined"` |
| `Object.entries requires...` | Schema field doesn't exist | Verify field names in `packages/db/schema/` |
| `Cannot find module` | Import path incorrect | Check actual export in target file |

## Contributing

When you fix a bug that took more than 30 minutes to debug:
1. Add it to **Known Issues & Fixes** with:
   - Clear problem description
   - Root cause analysis
   - Complete solution
   - Prevention guidelines
2. Update **Coding Standards** if it reveals a pattern to avoid
3. Add to the checklist if it's something to verify during development

---

**Maintained by**: Dev Team  
**Last Updated**: October 23, 2025

