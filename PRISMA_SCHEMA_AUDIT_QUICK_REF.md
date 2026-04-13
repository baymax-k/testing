# Prisma Schema Audit - Quick Reference

## 1. MISSING PRISMA MODELS

### Model: `Session`
- **Status**: Missing from schema (Required by Better-Auth)
- **Locations**: 6 references found
  - [src/config/auth.ts](src/config/auth.ts#L96) - Line 96
  - [src/middleware/auth.ts](src/middleware/auth.ts#L71) - Line 71
  - [src/__tests__/college-admin/integration.test.ts](src/__tests__/college-admin/integration.test.ts#L215) - Lines 215, 246
  - [src/modules/routes/college-admin.ts](src/modules/routes/college-admin.ts#L1963) - Line 1963
  - [tmp/debug-login.ts](tmp/debug-login.ts#L39) - Line 39

### Model: `Account`
- **Status**: Missing from schema (Required by Better-Auth for OAuth)
- **Locations**: 1 reference found
  - [tmp/debug-login.ts](tmp/debug-login.ts#L28) - Line 28

---

## 2. MISSING/INCORRECT FIELDS BY MODEL

### Question Model
| Field | Status | Type | Locations |
|-------|--------|------|-----------|
| `content` | ❌ MISSING | String | 2 references: [testService.ts#L627](src/modules/services/testService.ts#L627), [reportService.ts#L516](src/modules/services/reportService.ts#L516) |
| `marks` | ❌ MISSING | Int | 5 references: [testService.ts#L140](src/modules/services/testService.ts#L140), [L628](src/modules/services/testService.ts#L628), [L691](src/modules/services/testService.ts#L691), [reportService.ts#L519](src/modules/services/reportService.ts#L519) |
| `orderIndex` | ❌ MISSING | Int? | 2 references: [testService.ts#L520](src/modules/services/testService.ts#L520), [L632](src/modules/services/testService.ts#L632) |
| `explanation` | ❌ MISSING | String? | 1 reference: [testService.ts#L630](src/modules/services/testService.ts#L630) |

---

## 3. SPECIFIC LOCATIONS - DETAILED LISTING

### Session Model References (6 total)
```
✓ src/config/auth.ts:96
✓ src/middleware/auth.ts:71
✓ src/__tests__/college-admin/integration.test.ts:215
✓ src/__tests__/college-admin/integration.test.ts:246
✓ src/modules/routes/college-admin.ts:1963
✓ tmp/debug-login.ts:39
```

### Account Model References (1 total)
```
✓ tmp/debug-login.ts:28
```

### Question.content References (2 total)
```
✓ src/modules/services/testService.ts:627
✓ src/modules/services/reportService.ts:516
```

### Question.marks References (5 total)
```
✓ src/modules/services/testService.ts:140
✓ src/modules/services/testService.ts:628
✓ src/modules/services/testService.ts:691
✓ src/modules/services/reportService.ts:519
```

### Question.orderIndex References (2 total)
```
✓ src/modules/services/testService.ts:520
✓ src/modules/services/testService.ts:632
```

### Question.explanation References (1 total)
```
✓ src/modules/services/testService.ts:630
```

### dailyPracticeActivity (Incorrect Name) References (10 total)
```
✓ test/practiceActivity.unit.test.ts:45
✓ test/practiceActivity.unit.test.ts:46
✓ test/practiceActivity.unit.test.ts:57
✓ test/practiceActivity.unit.test.ts:63
✓ test/practiceActivity.unit.test.ts:70
✓ test/practiceActivity.unit.test.ts:79
✓ test/practiceActivity.unit.test.ts:87
✓ test/practiceActivity.unit.test.ts:96
✓ test/practiceActivity.unit.test.ts:100
✓ test/practiceActivity.unit.test.ts:109
```

---

## Summary Stats
- **Total Missing Models**: 2
- **Total Missing Fields**: 4
- **Total Wrong References**: 10 (same test file)
- **Total Files Affected**: 8
- **Critical Issues**: 6 (Missing models break auth)
- **High Priority**: 4 (Missing Question fields break tests)
- **Medium Priority**: 10 (Wrong model references)

