-- Add functions to pending_operators to preserve operator roles before activation
ALTER TABLE "public"."pending_operators"
ADD COLUMN "functions" "public"."UserFunction"[] NOT NULL DEFAULT ARRAY[]::"public"."UserFunction"[];
