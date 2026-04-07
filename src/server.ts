POST /api/auth/register — cadastro com CNPJ + senha
POST /api/auth/login — login
GET /api/me — perfil completo do usuário
POST/GET /api/company — cadastro da empresa
POST /api/fiscal-engine/query — motor fiscal (agora autenticado)
GET /api/fiscal-engine/history — histórico do usuário
GET /api/plans — lista os planos
POST /api/billing/pix — gera cobrança PIX
GET /api/billing/:id/status — consulta pagamento
POST /api/billing/:id/confirm — confirma pagamento
