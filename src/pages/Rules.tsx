import Layout from '../components/Layout'

export default function Rules() {
  return (
    <Layout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Rules & Scoring</h1>

        {/* Overview */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Playoff Gauntlet is a playoff fantasy football game where <strong>each NFL player can only be used once</strong> across all 4 playoff weeks. The winner is whoever accumulates the most points by the end of the Super Bowl.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li><strong>Player Pool:</strong> All NFL players from teams still alive in the playoffs</li>
              <li><strong>Key Mechanic:</strong> Once you use a player in your lineup, they're locked and cannot be used again</li>
              <li><strong>Strategy:</strong> Balance scoring now vs. saving players for later rounds</li>
              <li><strong>Entry Fee:</strong> $25 per entry (unlimited entries allowed)</li>
            </ul>
          </div>
        </section>

        {/* Roster Requirements */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Roster Requirements</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Weeks 1-3</h3>
              <p className="text-sm text-gray-500 mb-3">Wild Card, Divisional, Conference Championships</p>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">QB</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">RB</td>
                    <td className="py-2 text-right font-medium">3</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">WR</td>
                    <td className="py-2 text-right font-medium">4</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">TE</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">K</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">DEF</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-gray-900">Total</td>
                    <td className="py-2 text-right font-bold text-blue-600">15</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-red-600">All 15 slots must be filled</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Week 4</h3>
              <p className="text-sm text-gray-500 mb-3">Super Bowl</p>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">QB</td>
                    <td className="py-2 text-right font-medium">1</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">RB</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">WR</td>
                    <td className="py-2 text-right font-medium">2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">TE</td>
                    <td className="py-2 text-right font-medium">1</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">K</td>
                    <td className="py-2 text-right font-medium">1</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">DEF</td>
                    <td className="py-2 text-right font-medium">1</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-gray-900">Total</td>
                    <td className="py-2 text-right font-bold text-blue-600">8</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-green-600">Partial rosters allowed if no eligible players remain</p>
            </div>
          </div>
        </section>

        {/* Scoring */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Scoring System</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Passing */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Passing</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Passing Yards</td>
                    <td className="py-2 text-right font-medium">0.04/yard</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Passing TD</td>
                    <td className="py-2 text-right font-medium text-green-600">+6</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Interception</td>
                    <td className="py-2 text-right font-medium text-red-600">-2</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">2PT Conversion</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Rushing */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Rushing</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Rushing Yards</td>
                    <td className="py-2 text-right font-medium">0.1/yard</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Rushing TD</td>
                    <td className="py-2 text-right font-medium text-green-600">+6</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">2PT Conversion</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Receiving */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Receiving (PPR)</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Reception</td>
                    <td className="py-2 text-right font-medium text-green-600">+0.5</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Receiving Yards</td>
                    <td className="py-2 text-right font-medium">0.1/yard</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Receiving TD</td>
                    <td className="py-2 text-right font-medium text-green-600">+6</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">2PT Conversion</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Kicking */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Kicking</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Field Goal</td>
                    <td className="py-2 text-right font-medium">0.1/yard</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Extra Point Made</td>
                    <td className="py-2 text-right font-medium text-green-600">+1</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Extra Point Missed</td>
                    <td className="py-2 text-right font-medium text-red-600">-1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Defense */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Team Defense</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Fumble Recovery</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Interception</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Sack</td>
                    <td className="py-2 text-right font-medium text-green-600">+1</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Safety</td>
                    <td className="py-2 text-right font-medium text-green-600">+2</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Points Allowed */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Points Allowed (DEF)</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">0-6 pts</td>
                    <td className="py-2 text-right font-medium text-green-600">+10</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">7-13 pts</td>
                    <td className="py-2 text-right font-medium text-green-600">+7</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">14-20 pts</td>
                    <td className="py-2 text-right font-medium text-green-600">+4</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">21-27 pts</td>
                    <td className="py-2 text-right font-medium text-green-600">+1</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">28-34 pts</td>
                    <td className="py-2 text-right font-medium">0</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">35-41 pts</td>
                    <td className="py-2 text-right font-medium text-red-600">-1</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">42+ pts</td>
                    <td className="py-2 text-right font-medium text-red-600">-3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Misc scoring */}
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Miscellaneous</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fumble Lost</span>
                <span className="font-medium text-red-600">-2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Punt Return TD</span>
                <span className="font-medium text-green-600">+6</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Kick Return TD</span>
                <span className="font-medium text-green-600">+6</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payouts */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payouts</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Payout spots scale based on total entries:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">1-49 entries</div>
                <div className="font-semibold text-gray-900">Top 4</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">50-59 entries</div>
                <div className="font-semibold text-gray-900">Top 5</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">60-69 entries</div>
                <div className="font-semibold text-gray-900">Top 6</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">100+ entries</div>
                <div className="font-semibold text-gray-900">Top 10</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              <strong>Tiebreaker:</strong> Most points scored during Super Bowl week. If still tied, co-champions split the position.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  )
}
