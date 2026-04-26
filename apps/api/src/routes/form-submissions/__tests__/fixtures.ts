/**
 * Test Fixtures for Form Submissions
 * Provides mock data for unit tests
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 */

import { UserRole } from "@supplex/types";
import type { AuthContext } from "../../../lib/rbac/middleware";

// Mock Users
export const mockSupplierUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  email: "supplier@example.com",
  role: UserRole.SUPPLIER_USER,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

export const mockAdminUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  email: "admin@example.com",
  role: UserRole.ADMIN,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

export const mockProcurementUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  email: "procurement@example.com",
  role: UserRole.PROCUREMENT_MANAGER,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

// Mock Form Template ID
export const mockFormTemplateId = "750e8400-e29b-41d4-a716-446655440000";

// Mock Form Field IDs
export const mockTextField1Id = "850e8400-e29b-41d4-a716-446655440001";
export const mockTextField2Id = "850e8400-e29b-41d4-a716-446655440002";
export const mockNumberFieldId = "850e8400-e29b-41d4-a716-446655440003";
export const mockDropdownFieldId = "850e8400-e29b-41d4-a716-446655440004";

// Mock Submission ID
export const mockSubmissionId = "950e8400-e29b-41d4-a716-446655440000";

// Valid Draft Data
export const validDraftData = {
  formTemplateId: mockFormTemplateId,
  processInstanceId: null,
  answers: [
    {
      formFieldId: mockTextField1Id,
      answerValue: "Test Company",
    },
    {
      formFieldId: mockNumberFieldId,
      answerValue: "42",
    },
  ],
};

// Valid Draft Data with Process Instance
export const validDraftDataWithProcess = {
  ...validDraftData,
  processInstanceId: "a50e8400-e29b-41d4-a716-446655440000",
};

// Draft Data with Empty Answers
export const draftDataEmptyAnswers = {
  formTemplateId: mockFormTemplateId,
  processInstanceId: null,
  answers: [],
};

// Draft Data with Invalid Field ID
export const draftDataInvalidFieldId = {
  formTemplateId: mockFormTemplateId,
  processInstanceId: null,
  answers: [
    {
      formFieldId: "invalid-field-id",
      answerValue: "Test",
    },
  ],
};

// Draft Data with Invalid Number
export const draftDataInvalidNumber = {
  formTemplateId: mockFormTemplateId,
  processInstanceId: null,
  answers: [
    {
      formFieldId: mockNumberFieldId,
      answerValue: "not-a-number",
    },
  ],
};

/**
 * Helper function to seed test form template
 * Note: In production, this would insert into a test database
 * For unit tests without DB, we'll rely on mocking
 */
export function seedTestFormTemplate() {
  // TODO: Implement with test database connection
  console.log("Test form template seeding not implemented for unit tests");
}

/**
 * Helper function to cleanup test data
 * Note: In production, this would delete from test database
 */
export function cleanupTestData() {
  // TODO: Implement with test database connection
  console.log("Test data cleanup not implemented for unit tests");
}
