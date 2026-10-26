// Edge Function desativada: o Estúdio de IA foi removido do Hub.
// Fica publicada só para responder 410 (Gone) a qualquer chamada antiga, sem gerar nada.
// Os materiais já gerados continuam guardados em hub.materiais_ia.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(JSON.stringify({ erro: "O Estúdio de IA foi removido do Hub." }), {
    status: 410,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
