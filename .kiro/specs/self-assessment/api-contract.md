# API Contract: Self-Assessment Feature

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2024-12-18
**Related Issues:** #415

---

## 1. Overview

[Brief description of API purpose]

---

## 2. Authentication

All endpoints require Clerk JWT authentication via `Authorization: Bearer <token>` header.

---

## 3. Base URL

`/api/v1/self-assessments`

---

## 4. Endpoints

### 4.1. List Self-Assessments

```http
GET /self-assessments
```

**Query Parameters:**
- `periodId` (optional): UUID
- `userId` (optional): UUID
- `status` (optional): string
- `page` (optional): number
- `limit` (optional): number

**Response 200:**
```json
{

}
```

**Response 403:**
```json
{

}
```

---

### 4.2. Get Self-Assessment by Goal

```http
GET /self-assessments/by-goal/:goalId
```

[Add endpoint details]

---

### 4.3. Create Self-Assessment

```http
POST /self-assessments
```

[Add endpoint details]

---

### 4.4. Update Self-Assessment

```http
PUT /self-assessments/:id
```

[Add endpoint details]

---

### 4.5. Submit Self-Assessment

```http
POST /self-assessments/:id/submit
```

[Add endpoint details]

---

### 4.6. Delete Self-Assessment

```http
DELETE /self-assessments/:id
```

[Add endpoint details]

---

## 5. Schemas

### Request Schemas

```typescript
// Add TypeScript interface definitions
```

### Response Schemas

```typescript
// Add TypeScript interface definitions
```

---

## 6. Error Responses

```typescript
interface ApiError {
  success: false;
  errorMessage: string;
  errorCode?: string;
  details?: any;
}
```

**Error Codes:**
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `ALREADY_SUBMITTED`
- `PERMISSION_DENIED`

---

## 7. Validation Rules

[Document all validation rules]

---

## 8. Rate Limiting

[Document rate limits]

---

## 9. Permissions

[Document permission requirements]

---

## References

- Domain Model: [domain-model.md](./domain-model.md)
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
