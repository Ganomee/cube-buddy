export const MANAGED_PLAYER_PREFIX = 'Cube Buddy · ';

export function planResidualContributions(desiredCards, existingContributions) {
  return desiredCards.map((card) => {
    if (!card.oracleId || !Number.isSafeInteger(card.games) || !Number.isSafeInteger(card.wins) || card.games < 0 || card.wins < 0 || card.wins > card.games) {
      throw new Error('Cube Buddy performance contains an invalid card result');
    }
    const represented = existingContributions
      .filter((entry) => !entry.playerName.startsWith(MANAGED_PLAYER_PREFIX) && entry.oracleIds.includes(card.oracleId))
      .reduce((total, entry) => ({ wins: total.wins + entry.wins, losses: total.losses + entry.losses }), { wins: 0, losses: 0 });
    const wins = card.wins - represented.wins;
    const losses = card.games - card.wins - represented.losses;
    if (wins < 0 || losses < 0) {
      return { oracleId: card.oracleId, status: 'needs-review', reason: 'Cube Cobra already contains more outcomes than Cube Buddy' };
    }
    return { playerName: `${MANAGED_PLAYER_PREFIX}${card.oracleId}`, oracleIds: [card.oracleId], wins, losses, draws: 0 };
  });
}
