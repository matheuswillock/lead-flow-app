UPDATE corretor_studio_profiles
SET role = 'manager',
    "managerId" = '0c96a57e-6cc1-400f-bf3a-5740b699ac21',
    "activeTeamId" = '7f321ad6-d894-48f3-89c2-06e5506f0465',
    "updatedAt" = now()
WHERE id = '405711fa-335d-4b7f-a88a-fc3b9adad504'
RETURNING id, "fullName", role, "managerId", "activeTeamId";;
