# Supplex Documentation Index

Complete reference for all documentation in the project.

---

## 🚀 Start Here

### For New Developers
1. **[Quick Reference](./QUICK-REFERENCE.md)** - Keep open while coding
2. **[Remix Patterns](./architecture/remix-patterns.md)** - **REQUIRED READING** for all frontend work
3. **[Coding Standards](./architecture/coding-standards.md)** - Project-wide standards
4. **[Tech Stack](./architecture/tech-stack.md)** - Technology decisions

### For Creating New Features
1. **[Remix Route Template](./templates/remix-route-template.tsx)** - Copy this when creating routes
2. **[Template Usage Guide](./templates/README.md)** - How to use templates
3. **[Remix Patterns](./architecture/remix-patterns.md)** - Complete pattern documentation

---

## 📚 Documentation Structure

### Architecture (`docs/architecture/`)
- **[Tech Stack](./architecture/tech-stack.md)** - Definitive technology selection
- **[Coding Standards](./architecture/coding-standards.md)** - Project-wide standards
- **[Remix Patterns](./architecture/remix-patterns.md)** ⭐ - **CRITICAL** - Standard patterns for routes

### Templates (`docs/templates/`)
- **[README](./templates/README.md)** - How to use templates
- **[Remix Route Template](./templates/remix-route-template.tsx)** - Copy-paste route template

### Troubleshooting (`docs/troubleshooting/`)
- **[README](./troubleshooting/README.md)** - Troubleshooting index
- **[Known Issues & Fixes](./troubleshooting/known-issues-and-fixes.md)** - Common problems and solutions
- **[Environment Files Protection](./troubleshooting/ENV-FILES-PROTECTION.md)** - 🛡️ **CRITICAL** for AI agents

### Implementation Notes (`docs/implementation-notes/`)
- **[Remix Loader Pattern Optimization](./implementation-notes/remix-loader-pattern-optimization.md)** - Case study of performance optimization

### Stories (`docs/stories/`)
- Story files for each feature (e.g., `1.8.story.md`)
- **[Story Template](./story-template.md)** - Template for new stories

### QA Gates (`docs/qa/gates/`)
- Quality assurance checklists for each feature

---

## 🎯 Quick Access by Topic

### Remix Development
- **Patterns** → [Remix Patterns](./architecture/remix-patterns.md)
- **Template** → [Remix Route Template](./templates/remix-route-template.tsx)
- **Example** → `apps/web/app/routes/suppliers.$id.tsx`
- **Common Issues** → [Known Issues - Issue 3, 4](./troubleshooting/known-issues-and-fixes.md)

### API Development (ElysiaJS)
- **Authentication** → [Known Issues - Issue 1](./troubleshooting/known-issues-and-fixes.md#issue-1-authentication-middleware---userrole-is-undefined)
- **Validation** → [Known Issues - Issue 5](./troubleshooting/known-issues-and-fixes.md#issue-5-mixing-zod-and-typebox-schemas-in-elysiajs)
- **Standards** → [Coding Standards - ElysiaJS Validation](./architecture/coding-standards.md)

### Database
- **Schema** → `packages/db/schema/`
- **Common Issues** → [Known Issues - Issue 2](./troubleshooting/known-issues-and-fixes.md#issue-2-schema-mismatch---user-fields-dont-exist)
- **Standards** → [Coding Standards - Database Schema](./architecture/coding-standards.md)

### Performance
- **Optimization Case Study** → [Remix Loader Pattern Optimization](./implementation-notes/remix-loader-pattern-optimization.md)
- **Best Practices** → [Remix Patterns - Performance](./architecture/remix-patterns.md#performance-benefits)

---

## 📖 Documentation by Role

### Frontend Developer
**Must Read:**
1. [Remix Patterns](./architecture/remix-patterns.md) ⭐ **CRITICAL**
2. [Coding Standards](./architecture/coding-standards.md)
3. [Quick Reference](./QUICK-REFERENCE.md)

**Templates:**
- [Remix Route Template](./templates/remix-route-template.tsx)

**Troubleshooting:**
- [Known Issues & Fixes](./troubleshooting/known-issues-and-fixes.md)

### Backend Developer
**Must Read:**
1. [Coding Standards - Authentication](./architecture/coding-standards.md)
2. [Coding Standards - ElysiaJS Validation](./architecture/coding-standards.md)
3. [Quick Reference](./QUICK-REFERENCE.md)

**Troubleshooting:**
- [Known Issues - Auth Middleware](./troubleshooting/known-issues-and-fixes.md#issue-1)
- [Known Issues - TypeBox/Zod](./troubleshooting/known-issues-and-fixes.md#issue-5)

### Full Stack Developer
**Must Read:**
- Everything above, plus:
- [Tech Stack](./architecture/tech-stack.md)
- [Environment Variables](./architecture/coding-standards.md#environment-variables)

---

## 🔧 By Task Type

### Creating a New Page/Route
1. Read: [Remix Patterns](./architecture/remix-patterns.md)
2. Copy: [Remix Route Template](./templates/remix-route-template.tsx)
3. Reference: `apps/web/app/routes/suppliers.$id.tsx`
4. Check: [Template Usage Guide](./templates/README.md)

### Adding API Endpoints
1. Check: [Coding Standards - Auth](./architecture/coding-standards.md#authentication-middleware)
2. Check: [Coding Standards - Validation](./architecture/coding-standards.md#elysiajs-validation)
3. Reference: `apps/api/src/routes/suppliers/detail.ts`

### Fixing Performance Issues
1. Read: [Remix Loader Pattern Optimization](./implementation-notes/remix-loader-pattern-optimization.md)
2. Check: [Remix Patterns - shouldRevalidate](./architecture/remix-patterns.md#preventing-unnecessary-revalidation)

### Debugging Issues
1. Check: [Known Issues & Fixes](./troubleshooting/known-issues-and-fixes.md)
2. Check: [Quick Reference - Common Errors](./QUICK-REFERENCE.md#common-errors--quick-fixes)

---

## 📋 Checklists

### Before Starting Development
- [ ] Read [Remix Patterns](./architecture/remix-patterns.md) if working on frontend
- [ ] Read [Coding Standards](./architecture/coding-standards.md)
- [ ] Familiarize with [Quick Reference](./QUICK-REFERENCE.md)
- [ ] Check for relevant templates in `docs/templates/`

### Before Committing Code
See: [Quick Reference - Pre-Commit Checklist](./QUICK-REFERENCE.md#pre-commit-checklist)

### Before Code Review
- [ ] All patterns followed (Remix, Auth, etc.)
- [ ] No items from "DON'T" lists in documentation
- [ ] Performance considerations addressed
- [ ] Error handling implemented
- [ ] TypeScript types correct

---

## 🆕 Recently Added

**October 23, 2025:**
- ⭐ **[Remix Patterns](./architecture/remix-patterns.md)** - Complete pattern documentation (**CRITICAL**)
- **[Remix Route Template](./templates/remix-route-template.tsx)** - Reusable template
- **[Template Usage Guide](./templates/README.md)** - How to use templates
- **[Remix Loader Pattern Optimization](./implementation-notes/remix-loader-pattern-optimization.md)** - Performance case study
- **[Known Issues & Fixes](./troubleshooting/known-issues-and-fixes.md)** - Issues 1-5 documented

---

## 🔄 Keeping Documentation Updated

### When to Update Documentation

**Update immediately when:**
- New patterns are established
- Common bugs are fixed
- Architecture changes
- New tools/libraries added
- Breaking changes made

**Where to document:**
- **Patterns** → `docs/architecture/remix-patterns.md`
- **Standards** → `docs/architecture/coding-standards.md`
- **Issues** → `docs/troubleshooting/known-issues-and-fixes.md`
- **Templates** → `docs/templates/`
- **Quick fixes** → `docs/QUICK-REFERENCE.md`

### Documentation Principles
1. **Write for future developers** (including yourself in 6 months)
2. **Include why, not just how**
3. **Show examples** (good and bad)
4. **Keep it actionable** (clear steps, not theory)
5. **Cross-reference** related docs

---

## 📞 Getting Help

### Documentation Issues
- If documentation is unclear or incorrect, update it!
- If a pattern is missing, document it
- If a template is needed, create it

### Technical Issues
1. Check [Known Issues & Fixes](./troubleshooting/known-issues-and-fixes.md)
2. Check [Quick Reference](./QUICK-REFERENCE.md)
3. Search codebase for similar implementations
4. Ask team

---

**Last Updated**: October 23, 2025  
**Maintained By**: Dev Team  
**Next Review**: When new patterns are established

