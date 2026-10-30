// Only explicit control phrases bypass echo filtering. Common words such as
// "não" and the Portuguese preposition "no" occur throughout Jarvis's answers
// and must never turn his own playback into a new user interruption.
export const INTERRUPT_COMMAND =
  /^\s*(?:jarvis[\s,.:;-]+)?(?:stop(?:\s+(?:talking|speaking))?|wait|jarvis|cancel|enough|quiet|hold on|shut up|never ?mind|forget it|pare(?:\s+de\s+falar)?|espera|espere|cancela|chega|sil[eê]ncio|calado|esquece)(?:\s+(?:por favor|please))?[\s.!?]*$/i
