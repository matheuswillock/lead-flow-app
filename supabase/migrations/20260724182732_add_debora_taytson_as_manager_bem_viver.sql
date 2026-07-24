INSERT INTO corretor_studio_team_members (id, "teamId", "profileId", role, functions, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '7f321ad6-d894-48f3-89c2-06e5506f0465', '405711fa-335d-4b7f-a88a-fc3b9adad504', 'manager', ARRAY[]::"UserFunction"[], now(), now())
RETURNING id, "teamId", "profileId", role;;
