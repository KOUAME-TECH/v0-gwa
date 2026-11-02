-- Excellence iter 5 (préparé, NON appliqué automatiquement)
-- Passe chat-media en non-public. [RISQUE] casse les media_url publiques historiques.
-- Prérequis : tous les clients utilisent /api/chat/media/sign uniquement.
-- [ACTION HUMAINE REQUISE] valider staging puis appliquer.

-- UPDATE storage.buckets SET public = false WHERE id = 'chat-media';
