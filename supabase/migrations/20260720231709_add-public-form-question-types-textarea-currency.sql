-- Add textarea and currency to PublicFormQuestionType
ALTER TYPE "PublicFormQuestionType" ADD VALUE IF NOT EXISTS 'textarea';
ALTER TYPE "PublicFormQuestionType" ADD VALUE IF NOT EXISTS 'currency';
