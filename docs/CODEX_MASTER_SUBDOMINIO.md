# Codex — Configuração do subdomínio do MercadoMaster

## Objetivo
Configurar o acesso administrativo do MercadoFood pelo subdomínio:

`master.meumerdofood.com`

Esse endereço deve abrir diretamente o MercadoMaster, sem exigir que o usuário digite `/master` manualmente.

## Contexto atual
- Projeto Vercel: `mercadofood`
- Repositório GitHub: `Joarfram/mercadofood`
- O MercadoMaster já existe na rota `/master`.
- O acesso ao Master deve continuar protegido por autenticação e pela regra `platform_staff` / nível `master`.
- Não remover nem enfraquecer as verificações de autorização existentes.
- O DNS do domínio é administrado na HostGator.

## Tarefas para executar

### 1. Configurar o domínio na Vercel
Adicionar o domínio:

`master.meumerdofood.com`

no projeto `mercadofood` da Vercel.

Depois de adicionar, verificar qual registro DNS a Vercel solicitar. Não assumir o valor do CNAME antes da confirmação da própria Vercel.

### 2. Configurar o DNS na HostGator
No Editor de Zona DNS da HostGator, criar o registro solicitado pela Vercel para o host `master`.

Preferência esperada:
- Tipo: `CNAME`
- Host/Nome: `master`
- Destino: usar exatamente o valor informado pela Vercel

Não alterar registros do domínio principal sem necessidade.

### 3. Fazer o subdomínio abrir diretamente o MercadoMaster
Implementar no Next.js uma regra baseada no `Host` para que:

`https://master.meumerdofood.com`

abra a área `/master`.

Comportamento desejado:
- `/` no subdomínio Master deve encaminhar para `/master`.
- As rotas internas do MercadoMaster devem continuar funcionando normalmente.
- Não criar loop de redirecionamento.
- Não afetar o domínio principal nem os cardápios públicos.

Implementação sugerida: usar middleware/rewrite/redirect no ponto já existente do projeto, escolhendo a solução mais simples e compatível com a estrutura atual.

### 4. Preservar a segurança
O subdomínio é apenas uma forma de acesso. A segurança deve continuar sendo feita pelo sistema.

Obrigatório manter:
- usuário autenticado;
- validação em `platform_staff`;
- `is_active = true`;
- nível mínimo apropriado (`master` para ações administrativas sensíveis);
- redirecionamento para login quando não autenticado;
- bloqueio para usuários sem permissão.

Não usar apenas o hostname como mecanismo de autorização.

### 5. Ajustar URLs internas, se necessário
Verificar se há dependência de `NEXT_PUBLIC_APP_URL` ou URLs absolutas para login, convites ou redirects.

O domínio público principal e o subdomínio Master não devem quebrar os fluxos existentes.

Se for necessário adicionar o subdomínio em Redirect URLs do Supabase Auth, incluir:

`https://master.meumerdofood.com/**`

Somente fazer essa alteração se o fluxo de autenticação realmente exigir.

### 6. Testes obrigatórios
Antes de considerar concluído, testar:

1. Abrir `https://master.meumerdofood.com` sem login.
   - Deve direcionar para login.
2. Entrar com usuário Master.
   - Deve abrir o MercadoMaster.
3. Entrar com usuário comum.
   - Não pode acessar o MercadoMaster.
4. Abrir diretamente:
   - `/master/empresas`
   - `/master/convites`
   - `/master/planos`
   - `/master/suporte`
5. Confirmar que o domínio principal e os cardápios públicos continuam funcionando.
6. Confirmar HTTPS válido na Vercel.
7. Confirmar ausência de loop de redirect.

## Critério de conclusão
Considerar concluído somente quando:
- `master.meumerdofood.com` estiver validado na Vercel;
- DNS estiver propagado;
- HTTPS estiver ativo;
- raiz do subdomínio abrir o MercadoMaster;
- autenticação e autorização continuarem protegendo a área;
- domínio principal continuar funcionando sem regressões.

## Observação importante
Não publicar mudanças destrutivas nem alterar DNS do domínio principal sem necessidade. Fazer a configuração do subdomínio de forma isolada e reversível.