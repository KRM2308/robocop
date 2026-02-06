import React, { useMemo, useState } from 'react'

const SITE_CATALOG = [
  {
    id: 'france-travail',
    name: 'France Travail',
    location: 'France',
    focus: 'Public',
    listings: [
      {
        title: 'Développeur Front-End React',
        company: 'Ville de Lyon',
        location: 'Lyon',
        contract: 'CDI',
        tags: ['React', 'Accessibilité', 'Service public'],
        url: 'https://www.francetravail.fr/',
        posted: 'Aujourd’hui',
      },
      {
        title: 'Technicien Support Informatique',
        company: 'Conseil Départemental',
        location: 'Nantes',
        contract: 'CDD',
        tags: ['Support', 'ITIL', 'Bureautique'],
        url: 'https://www.francetravail.fr/',
        posted: 'Il y a 2 jours',
      },
    ],
  },
  {
    id: 'welcome-to-the-jungle',
    name: 'Welcome to the Jungle',
    location: 'France',
    focus: 'Startup',
    listings: [
      {
        title: 'Product Designer',
        company: 'NovaCare',
        location: 'Paris',
        contract: 'CDI',
        tags: ['UX', 'Design system', 'Figma'],
        url: 'https://www.welcometothejungle.com/',
        posted: 'Hier',
      },
      {
        title: 'Sales Operations Manager',
        company: 'Flowly',
        location: 'Remote',
        contract: 'CDI',
        tags: ['Salesforce', 'Data', 'Remote'],
        url: 'https://www.welcometothejungle.com/',
        posted: 'Il y a 3 jours',
      },
    ],
  },
  {
    id: 'indeed',
    name: 'Indeed',
    location: 'International',
    focus: 'Multi-secteurs',
    listings: [
      {
        title: 'Data Analyst',
        company: 'BrightOps',
        location: 'Lille',
        contract: 'CDI',
        tags: ['SQL', 'BI', 'Python'],
        url: 'https://fr.indeed.com/',
        posted: 'Aujourd’hui',
      },
      {
        title: 'Chef de Projet Digital',
        company: 'Oxygène Média',
        location: 'Remote',
        contract: 'Freelance',
        tags: ['Agile', 'Marketing', 'Remote'],
        url: 'https://fr.indeed.com/',
        posted: 'Il y a 5 jours',
      },
    ],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    location: 'International',
    focus: 'Cadres & Tech',
    listings: [
      {
        title: 'Ingénieur DevOps',
        company: 'SentryCloud',
        location: 'Toulouse',
        contract: 'CDI',
        tags: ['AWS', 'Terraform', 'Kubernetes'],
        url: 'https://www.linkedin.com/jobs/',
        posted: 'Aujourd’hui',
      },
      {
        title: 'Customer Success Manager',
        company: 'Pulse AI',
        location: 'Remote',
        contract: 'CDI',
        tags: ['SaaS', 'Onboarding', 'Remote'],
        url: 'https://www.linkedin.com/jobs/',
        posted: 'Il y a 1 jour',
      },
    ],
  },
]

const buildEmptyResults = () =>
  SITE_CATALOG.reduce((acc, site) => {
    acc[site.id] = []
    return acc
  }, {})

export default function App() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [contract, setContract] = useState('Tous')
  const [selectedSites, setSelectedSites] = useState(() =>
    SITE_CATALOG.reduce((acc, site) => {
      acc[site.id] = true
      return acc
    }, {})
  )
  const [siteStatus, setSiteStatus] = useState(() =>
    SITE_CATALOG.reduce((acc, site) => {
      acc[site.id] = 'idle'
      return acc
    }, {})
  )
  const [results, setResults] = useState(buildEmptyResults)
  const [lastRun, setLastRun] = useState(null)

  const activeSites = useMemo(
    () => SITE_CATALOG.filter((site) => selectedSites[site.id]),
    [selectedSites]
  )

  const totalResults = useMemo(
    () => Object.values(results).reduce((sum, siteResults) => sum + siteResults.length, 0),
    [results]
  )

  const toggleSite = (siteId) => {
    setSelectedSites((prev) => ({ ...prev, [siteId]: !prev[siteId] }))
  }

  const runScrape = async () => {
    if (activeSites.length === 0) {
      return
    }

    setSiteStatus((prev) =>
      activeSites.reduce((acc, site) => {
        acc[site.id] = 'loading'
        return acc
      }, { ...prev })
    )

    const normalizedQuery = query.trim().toLowerCase()
    const normalizedLocation = location.trim().toLowerCase()

    const sitePromises = activeSites.map((site, index) =>
      new Promise((resolve) => {
        const delay = 400 + index * 250
        setTimeout(() => {
          const filtered = site.listings.filter((listing) => {
            const matchesQuery = normalizedQuery
              ? [listing.title, listing.company, listing.tags.join(' ')].join(' ').toLowerCase().includes(normalizedQuery)
              : true
            const matchesLocation = normalizedLocation
              ? listing.location.toLowerCase().includes(normalizedLocation)
              : true
            const matchesContract =
              contract === 'Tous' ? true : listing.contract.toLowerCase() === contract.toLowerCase()

            return matchesQuery && matchesLocation && matchesContract
          })

          resolve({ siteId: site.id, results: filtered })
        }, delay)
      })
    )

    const siteResults = await Promise.all(sitePromises)

    setResults((prev) =>
      siteResults.reduce((acc, { siteId, results: siteListings }) => {
        acc[siteId] = siteListings
        return acc
      }, { ...prev })
    )

    setSiteStatus((prev) =>
      siteResults.reduce((acc, { siteId }) => {
        acc[siteId] = 'ready'
        return acc
      }, { ...prev })
    )

    setLastRun(new Date())
  }

  const clearResults = () => {
    setResults(buildEmptyResults())
    setSiteStatus((prev) =>
      SITE_CATALOG.reduce((acc, site) => {
        acc[site.id] = 'idle'
        return acc
      }, { ...prev })
    )
    setLastRun(null)
  }

  return (
    <div className="min-h-screen p-6 font-robocop text-robocop-silver">
      <div className="max-w-6xl mx-auto bg-robocop-black p-6 rounded-lg neon-border space-y-6">
        <header className="space-y-3">
          <p className="text-robocop-red font-semibold tracking-[0.3em]">ROBOCOP JOB SCANNER</p>
          <h1 className="text-3xl md:text-4xl font-bold glow">Recherche d'emploi multi-sites</h1>
          <p className="text-robocop-silver/80">
            Lance une recherche ciblée sur plusieurs plateformes et agrège automatiquement les annonces qui
            correspondent à tes critères.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm">
                Mot-clé
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="p-2 bg-robocop-black text-robocop-silver border-robocop-red rounded focus:outline-none focus:ring-2 focus:ring-robocop-red"
                  placeholder="Ex: Développeur, Marketing..."
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Localisation
                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="p-2 bg-robocop-black text-robocop-silver border-robocop-red rounded focus:outline-none focus:ring-2 focus:ring-robocop-red"
                  placeholder="Ville ou remote"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Contrat
                <select
                  value={contract}
                  onChange={(event) => setContract(event.target.value)}
                  className="p-2 bg-robocop-black text-robocop-silver border-robocop-red rounded focus:outline-none focus:ring-2 focus:ring-robocop-red"
                >
                  <option>Tous</option>
                  <option>CDI</option>
                  <option>CDD</option>
                  <option>Freelance</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runScrape}
                className="px-4 py-2 bg-robocop-red text-robocop-black font-bold rounded hover:bg-robocop-blue transition-colors"
              >
                Lancer le scan
              </button>
              <button
                type="button"
                onClick={clearResults}
                className="px-4 py-2 border border-robocop-red text-robocop-red font-bold rounded hover:text-robocop-blue hover:border-robocop-blue transition-colors"
              >
                Réinitialiser
              </button>
              <div className="text-sm text-robocop-silver/70">
                {lastRun
                  ? `Dernier scan : ${lastRun.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Aucun scan lancé'}
              </div>
            </div>
          </div>

          <aside className="space-y-3 bg-robocop-black/80 p-4 rounded-lg neon-border">
            <h2 className="text-lg font-semibold text-robocop-red">Sources activées</h2>
            <div className="space-y-2">
              {SITE_CATALOG.map((site) => (
                <label key={site.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold">{site.name}</span>
                    <span className="block text-xs text-robocop-silver/70">{site.focus}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedSites[site.id]}
                    onChange={() => toggleSite(site.id)}
                    className="form-checkbox h-5 w-5 text-robocop-red rounded focus:ring-robocop-red"
                  />
                </label>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Résultats agrégés</h2>
              <span className="text-sm text-robocop-silver/70">{totalResults} annonces</span>
            </div>
            <div className="grid gap-4">
              {activeSites.map((site) => (
                <div key={site.id} className="p-4 bg-robocop-black/80 rounded-lg neon-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-robocop-red">{site.name}</h3>
                      <p className="text-xs text-robocop-silver/70">{site.location}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                        siteStatus[site.id] === 'loading'
                          ? 'text-robocop-blue'
                          : siteStatus[site.id] === 'ready'
                          ? 'text-robocop-silver'
                          : 'text-robocop-silver/50'
                      }`}
                    >
                      {siteStatus[site.id] === 'loading'
                        ? 'Scan en cours'
                        : siteStatus[site.id] === 'ready'
                        ? 'Terminé'
                        : 'En attente'}
                    </span>
                  </div>
                  {results[site.id].length === 0 ? (
                    <p className="text-sm text-robocop-silver/70">Aucune annonce pour ces critères.</p>
                  ) : (
                    <div className="grid gap-3">
                      {results[site.id].map((listing) => (
                        <article key={`${site.id}-${listing.title}`} className="p-3 rounded-lg bg-robocop-black">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{listing.title}</h4>
                              <p className="text-sm text-robocop-silver/70">
                                {listing.company} · {listing.location}
                              </p>
                            </div>
                            <span className="text-xs text-robocop-red font-semibold">{listing.contract}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs mt-2">
                            {listing.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 rounded-full border border-robocop-red/40 text-robocop-silver/80"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-robocop-silver/60 mt-3">
                            <span>{listing.posted}</span>
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-robocop-blue hover:text-robocop-red"
                            >
                              Voir l'annonce
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-robocop-black/80 rounded-lg neon-border space-y-3">
              <h2 className="text-lg font-semibold text-robocop-red">Statut du scraping</h2>
              <ul className="space-y-2 text-sm">
                {SITE_CATALOG.map((site) => (
                  <li key={site.id} className="flex items-center justify-between">
                    <span>{site.name}</span>
                    <span
                      className={`font-semibold ${
                        siteStatus[site.id] === 'loading'
                          ? 'text-robocop-blue'
                          : siteStatus[site.id] === 'ready'
                          ? 'text-robocop-silver'
                          : 'text-robocop-silver/50'
                      }`}
                    >
                      {siteStatus[site.id] === 'loading'
                        ? 'Scan en cours'
                        : siteStatus[site.id] === 'ready'
                        ? 'Actif'
                        : 'Inactif'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 bg-robocop-black/80 rounded-lg neon-border space-y-3">
              <h2 className="text-lg font-semibold text-robocop-red">Conseils de recherche</h2>
              <ul className="list-disc list-inside text-sm text-robocop-silver/80 space-y-2">
                <li>Combine un mot-clé et une ville pour filtrer plus précisément.</li>
                <li>Active uniquement les sites pertinents pour gagner du temps.</li>
                <li>Relance le scan régulièrement pour détecter les nouvelles annonces.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
