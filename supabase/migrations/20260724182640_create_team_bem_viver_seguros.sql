INSERT INTO corretor_studio_teams (id, name, "masterId", "isDefault", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Bem Viver Seguros', '0c96a57e-6cc1-400f-bf3a-5740b699ac21', false, now(), now())
RETURNING id, name, "masterId";;
