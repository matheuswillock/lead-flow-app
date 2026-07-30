-- Add jump_to action for public form conditional rules (skip intermediate questions until target).
ALTER TYPE "public"."PublicFormRuleAction" ADD VALUE IF NOT EXISTS 'jump_to';
