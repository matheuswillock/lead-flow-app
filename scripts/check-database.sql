-- ============================================
-- SCRIPT DE VERIFICAÇÃO DO BANCO DE DADOS
-- Lead Flow App - Diagnóstico Completo
-- ============================================

-- 1. VERIFICAR PROFILES (Usuários)
-- ============================================
SELECT 
    '=== PROFILES ===' as section,
    COUNT(*) as total_profiles
FROM profiles;

SELECT 
    id,
    "fullName",
    email,
    role,
    "isMaster",
    "managerId",
    "createdAt"
FROM profiles
ORDER BY "createdAt" DESC;

-- 2. VERIFICAR LEADS
-- ============================================
SELECT 
    '=== LEADS ===' as section,
    COUNT(*) as total_leads
FROM leads;

SELECT 
    id,
    name,
    email,
    phone,
    status,
    "managerId",
    "assignedTo",
    "createdBy",
    "createdAt"
FROM leads
ORDER BY "createdAt" DESC;

-- 3. VERIFICAR PENDING OPERATORS
-- ============================================
SELECT 
    '=== PENDING OPERATORS ===' as section,
    COUNT(*) as total_pending
FROM pending_operators;

SELECT 
    id,
    name,
    email,
    "paymentStatus",
    "operatorCreated",
    "managerId",
    "createdAt"
FROM pending_operators
ORDER BY "createdAt" DESC;

-- 4. VERIFICAR RELACIONAMENTOS PROFILE -> LEADS
-- ============================================
SELECT 
    '=== PROFILE LEADS COUNTS ===' as section;

SELECT 
    p.id as profile_id,
    p."fullName" as name,
    p.email,
    p.role,
    p."managerId",
    COUNT(l.id) as total_leads_managed,
    COUNT(l2.id) as total_leads_assigned
FROM profiles p
LEFT JOIN leads l ON l."managerId" = p.id
LEFT JOIN leads l2 ON l2."assignedTo" = p.id
GROUP BY p.id, p."fullName", p.email, p.role, p."managerId"
ORDER BY p."createdAt" DESC;

-- 5. VERIFICAR INTEGRIDADE DOS DADOS
-- ============================================
SELECT 
    '=== ORPHAN LEADS (sem manager) ===' as section;

SELECT 
    l.id,
    l.name,
    l.email,
    l."managerId",
    l."assignedTo"
FROM leads l
LEFT JOIN profiles p ON l."managerId" = p.id
WHERE p.id IS NULL;

SELECT 
    '=== ORPHAN LEADS (manager diferente do assigned) ===' as section;

SELECT 
    l.id,
    l.name,
    l."managerId" as lead_manager,
    l."assignedTo" as lead_assigned,
    p.id as assigned_profile_id,
    p."managerId" as assigned_manager_id
FROM leads l
INNER JOIN profiles p ON l."assignedTo" = p.id
WHERE p."managerId" IS NOT NULL 
  AND l."managerId" != p."managerId";

-- 6. RESUMO GERAL
-- ============================================
SELECT 
    '=== RESUMO GERAL ===' as section;

SELECT 
    (SELECT COUNT(*) FROM profiles WHERE role = 'manager') as total_managers,
    (SELECT COUNT(*) FROM profiles WHERE role = 'operator') as total_operators,
    (SELECT COUNT(*) FROM leads) as total_leads,
    (SELECT COUNT(*) FROM pending_operators) as total_pending_operators,
    (SELECT COUNT(*) FROM profiles WHERE "isMaster" = true) as total_masters;
