# Row Level Security (RLS) System Documentation

## Overview

This documentation covers the complete Row Level Security (RLS) implementation for the Clicarity platform. The system provides dynamic, role-based access control at the database row level.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [How It Works](#how-it-works)
3. [Backend API](#backend-api)
4. [Frontend Interface](#frontend-interface)
5. [Usage Examples](#usage-examples)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Role-Based Access Control

The system supports three user roles with different access levels:

| Role | Access Level | Description |
|------|-------------|-------------|
| **SuperAdmin** | Unrestricted | Full access to all data across all schemas |
| **Admin** | Schema-wide | Access to all data within their assigned schema |
| **Member** | Conditional | Restricted access based on custom conditions |

### Key Features

- ✅ **Dynamic Policy Creation** - Create policies programmatically via API
- ✅ **Multi-Schema Support** - Works across different PostgreSQL schemas
- ✅ **Flexible Conditions** - Define custom SQL conditions for members
- ✅ **Operation-Specific Policies** - Control SELECT, INSERT, UPDATE, DELETE separately
- ✅ **Policy Management** - View, create, and delete policies dynamically
- ✅ **Real-time Status** - Check RLS status across tables and schemas

---

## How It Works

### PostgreSQL Row Level Security

RLS is a PostgreSQL feature that restricts which rows a user can access. Our system creates policies that:

1. Check the current user's role (from the `users` table)
2. Apply appropriate access rules based on the role
3. Filter data automatically at the database level

### Example Policy Logic

```sql
-- SuperAdmin: No restrictions
EXISTS (
    SELECT 1 FROM users
    WHERE users.email = current_user
    AND users.role = 'superadmin'
)

-- Admin: Access to their schema
OR EXISTS (
    SELECT 1 FROM users
    WHERE users.email = current_user
    AND users.role = 'admin'
    AND users.schema_name = 'target_schema'
)

-- Member: Conditional access
OR (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.email = current_user
        AND users.role = 'member'
        AND users.schema_name = 'target_schema'
    )
    AND (custom_condition)
)
```

---

## Backend API

### Base URL

```
http://localhost:3000/api/permissions
```

### Endpoints

#### 1. Quick Setup (Recommended)

**POST** `/setup-complete-rls`

Enable RLS and create a policy in one step.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "employees",
  "condition": "department = (SELECT department FROM users WHERE email = current_user)",
  "policyName": "employees_rls_policy",
  "force": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complete RLS setup successful on company_abc.employees",
  "details": {
    "rlsEnabled": true,
    "forced": true,
    "policyName": "employees_rls_policy",
    "memberCondition": "department = (SELECT department FROM users WHERE email = current_user)"
  }
}
```

---

#### 2. Enable RLS

**POST** `/enable-rls`

Enable Row Level Security on a table.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "employees",
  "force": true
}
```

---

#### 3. Disable RLS

**POST** `/disable-rls`

Disable Row Level Security on a table.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "employees"
}
```

---

#### 4. Create Dynamic Policy

**POST** `/create-policy`

Create a new RLS policy with role-based rules.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "orders",
  "condition": "created_by = (SELECT id FROM users WHERE email = current_user)",
  "policyName": "orders_access_policy",
  "policyType": "combined"
}
```

**Policy Types:**
- `"combined"` - Single policy for all roles (recommended)
- `"separate"` - Individual policies per role

---

#### 5. Create Operation-Specific Policy

**POST** `/create-operation-policy`

Create a policy for specific operations.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "sensitive_data",
  "operation": "select",
  "condition": "owner_id = (SELECT id FROM users WHERE email = current_user)",
  "policyName": "sensitive_select_policy"
}
```

**Operations:** `select`, `insert`, `update`, `delete`

---

#### 6. Drop Policy

**DELETE** `/drop-policy`

Remove a specific policy.

**Request Body:**
```json
{
  "schemaName": "company_abc",
  "tableName": "employees",
  "policyName": "employees_rls_policy"
}
```

---

#### 7. List Policies

**GET** `/list-policies?schemaName=company_abc&tableName=employees`

Get all policies on a table.

**Response:**
```json
{
  "success": true,
  "schema": "company_abc",
  "table": "employees",
  "policies": [
    {
      "policyname": "employees_rls_policy",
      "cmd": "ALL",
      "qual": "(policy condition here)",
      "with_check": null
    }
  ]
}
```

---

#### 8. Check RLS Status

**GET** `/check-rls-status?schemaName=company_abc&tableName=employees`

Check if RLS is enabled on a table.

**Response:**
```json
{
  "success": true,
  "schema": "company_abc",
  "table": "employees",
  "rlsEnabled": true,
  "forceRls": true
}
```

---

#### 9. Get Schema RLS Status

**GET** `/schema-rls-status?schemaName=company_abc`

Get RLS status for all tables in a schema.

**Response:**
```json
{
  "success": true,
  "schema": "company_abc",
  "tables": [
    {
      "tablename": "employees",
      "rls_enabled": true,
      "force_rls": true
    },
    {
      "tablename": "orders",
      "rls_enabled": false,
      "force_rls": false
    }
  ]
}
```

---

## Frontend Interface

### Access the RLS Management Page

Navigate to: **`/admin/rls`**

### Features

#### 1. Quick Setup Tab
- Enable RLS and create policy in one click
- Select from predefined condition templates
- View current RLS status

#### 2. Manage Policies Tab
- Enable/Disable RLS
- Create new policies
- View and delete existing policies
- Expand policies to see conditions

#### 3. View Status Tab
- Check RLS status across all tables in a schema
- Visual indicators for enabled/disabled status

### Predefined Condition Templates

1. **User Department Match**
   ```sql
   department = (SELECT department FROM users WHERE email = current_user)
   ```

2. **User Ownership**
   ```sql
   created_by = (SELECT id FROM users WHERE email = current_user)
   ```

3. **User Region Match**
   ```sql
   region = (SELECT region FROM users WHERE email = current_user)
   ```

4. **Team Match**
   ```sql
   team_id = (SELECT team_id FROM users WHERE email = current_user)
   ```

5. **Custom Condition**
   - Write your own PostgreSQL condition

---

## Usage Examples

### Example 1: Department-Based Access

**Scenario:** Members should only see records from their department.

**Setup:**
```javascript
// Using API
POST /api/permissions/setup-complete-rls
{
  "schemaName": "company_abc",
  "tableName": "employees",
  "condition": "department = (SELECT department FROM users WHERE email = current_user)"
}
```

**Result:**
- SuperAdmin: Sees all employees
- Admin (company_abc): Sees all employees in company_abc schema
- Member (Sales dept): Sees only Sales department employees

---

### Example 2: Record Ownership

**Scenario:** Members can only access records they created.

**Setup:**
```javascript
POST /api/permissions/setup-complete-rls
{
  "schemaName": "company_abc",
  "tableName": "orders",
  "condition": "created_by = (SELECT id FROM users WHERE email = current_user)"
}
```

---

### Example 3: Multi-Condition Access

**Scenario:** Members see records from their region AND department.

**Setup:**
```javascript
POST /api/permissions/setup-complete-rls
{
  "schemaName": "company_abc",
  "tableName": "sales_data",
  "condition": "region = (SELECT region FROM users WHERE email = current_user) AND department = (SELECT department FROM users WHERE email = current_user)"
}
```

---

### Example 4: Read-Only for Members

**Scenario:** Members can only SELECT, not modify data.

**Setup:**
```javascript
// Enable RLS
POST /api/permissions/enable-rls
{
  "schemaName": "company_abc",
  "tableName": "reports"
}

// Allow SELECT for members
POST /api/permissions/create-operation-policy
{
  "schemaName": "company_abc",
  "tableName": "reports",
  "operation": "select",
  "condition": "true"
}

// Block INSERT/UPDATE/DELETE for members (only admins can modify)
// No policy = no access for those operations
```

---

## Common Use Cases

### 1. Multi-Tenant SaaS Platform

Each admin has their own schema, members share that schema but see filtered data.

```sql
-- Admin sees everything in their schema
-- Member condition:
client_id = (SELECT client_id FROM users WHERE email = current_user)
```

---

### 2. Regional Sales Teams

Sales reps only see data from their assigned region.

```sql
region = (SELECT region FROM users WHERE email = current_user)
```

---

### 3. Project-Based Access

Team members only see projects they're assigned to.

```sql
EXISTS (
  SELECT 1 FROM project_members pm
  JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = projects.id
  AND u.email = current_user
)
```

---

### 4. Hierarchical Access

Managers see their team's data + their own.

```sql
manager_id = (SELECT id FROM users WHERE email = current_user)
OR created_by = (SELECT id FROM users WHERE email = current_user)
```

---

## Troubleshooting

### Issue: RLS Enabled but Users Still See All Data

**Cause:** No policy has been created, or policy doesn't match user conditions.

**Solution:**
1. Check if policies exist: `GET /api/permissions/list-policies`
2. Verify the policy condition matches your user table structure
3. Ensure users have correct `role` and `schema_name` in the users table

---

### Issue: SuperAdmin Can't See Data

**Cause:** RLS is enabled but policy doesn't include SuperAdmin condition.

**Solution:** Use the combined policy which includes SuperAdmin access, or create a specific policy for SuperAdmin.

---

### Issue: Policy Creation Fails

**Common Causes:**
1. Table doesn't exist - verify schema and table names
2. Syntax error in condition - test condition in PostgreSQL first
3. Referenced columns don't exist (e.g., `department` column missing)

**Solution:** Test your condition manually:
```sql
SELECT * FROM your_schema.your_table
WHERE your_condition;
```

---

### Issue: Members See No Data

**Cause:** Condition is too restrictive or user data doesn't match.

**Solution:**
1. Verify user has correct metadata (department, region, etc.)
2. Test condition with a known working user
3. Temporarily use `condition: "true"` to debug

---

## Best Practices

1. **Always Use Quick Setup for Initial Configuration**
   - Ensures RLS is enabled and policy is created atomically

2. **Test Policies with Different User Roles**
   - Login as SuperAdmin, Admin, and Member to verify access

3. **Use Template Conditions When Possible**
   - Pre-tested and known to work correctly

4. **Document Your Conditions**
   - Keep track of which tables have which conditions

5. **Monitor Policy Performance**
   - Complex conditions can slow down queries
   - Index columns used in RLS conditions

6. **Use Schema-Wide Strategy**
   - Apply consistent RLS patterns across all tables in a schema

---

## Security Considerations

⚠️ **Important:**
- RLS policies use `current_user` which maps to PostgreSQL database user
- Ensure your application connects with user-specific database credentials
- Never expose policy management endpoints to non-admin users
- Always use `force: true` to apply RLS even to table owners

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the API endpoint documentation
- Test policies manually in PostgreSQL first

---

**Version:** 1.0
**Last Updated:** 2026-01-03
**System:** Clicarity Backend + Frontend
