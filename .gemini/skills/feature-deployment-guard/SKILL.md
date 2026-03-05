---
name: feature-deployment-guard
description: Enforces database permission registration, migration script updates, and MANDATORY CHINESE LOCALIZATION for every new feature deployment. Use when implementing new UI features, API endpoints, or database schema changes.
---

# Feature Deployment Guard

## Purpose
Ensures that every new feature implementation is fully operational, documented for production, and localized correctly.

## Core Mandates

### 1. Permission Registration & Migration Tracking
**Trigger:** You are creating a new UI button, API route, or business module.
**Action:** Append SQL statements (using dynamic subqueries for role IDs) to `database/migrations/update.sql` with a timestamp header.

### 2. Local Database Execution (CRITICAL)
**Mandate**: After writing to `update.sql`, you MUST immediately execute the SQL in the local database to verify functionality.

### 3. Absolute Localization (CRITICAL)
**Mandate**: ALL user-facing strings (Labels, Tooltips, Placeholders, Toast messages, Chart Legends) MUST be in Chinese. English hardcoding is strictly forbidden.
**Action**: Scan for terms like 'Submit', 'Cancel', 'Edit', 'Loading', 'Score' and replace them before saving.

## Workflow Checklist
Before finishing a task, verify:
- [ ] Is the new API protected by `requirePermission`?
- [ ] Is the SQL recorded in `update.sql` AND executed locally?
- [ ] **Has every single English word in the UI been replaced with Chinese?**
- [ ] Do the logs show zero execution errors?
