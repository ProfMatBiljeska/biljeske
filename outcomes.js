/*
 * Ishodi i teme za bilješke.
 *
 * NAPOMENA O IZVORU: formulacije su preuzete iz godišnjih izvedbenih kurikuluma
 * objavljenih na i-nastava.gov.hr (MAT OŠ A.8.2., B.8.1.) i iz opisnika elementa
 * vrednovanja "Matematička komunikacija" (kurikulum NN 7/2019, kako ga navode
 * školski dokumenti). Prije službene uporabe provjeri formulacije s važećim tekstom.
 * Ovdje ih možeš mijenjati; nove razrede i teme dodaj u KURIKULUM.razredi.
 */
window.KURIKULUM = {
  // Elementi vrednovanja: Matematička komunikacija (isti opisnici za sve razrede)
  komunikacija: [
    { id: "KOM-1", tekst: "Koristi se odgovarajućim matematičkim jezikom (standardni matematički simboli, zapisi i terminologija) pri usmenome i pisanome izražavanju." },
    { id: "KOM-2", tekst: "Koristi se odgovarajućim matematičkim prikazima za predstavljanje podataka." },
    { id: "KOM-3", tekst: "Prelazi između različitih matematičkih prikaza." },
    { id: "KOM-4", tekst: "Svoje razmišljanje iznosi cjelovitim, suvislim i sažetim matematičkim rečenicama." },
    { id: "KOM-5", tekst: "Postavlja pitanja i odgovara na pitanja koja nadilaze opseg izvorno postavljenoga pitanja." },
    { id: "KOM-6", tekst: "Organizira informacije u logičku strukturu." },
    { id: "KOM-7", tekst: "Primjereno se koristi tehnologijom." }
  ],

  razredi: {
    "8": {
      naziv: "8. razred",
      teme: [
        {
          id: "kvadriranje-potenciranje",
          naziv: "Kvadriranje i potenciranje",
          ishodi: [
            {
              id: "A.8.2",
              oznaka: "MAT OŠ A.8.2.",
              tekst: "Računa s potencijama racionalne baze i nenegativnoga cjelobrojnog eksponenta.",
              // Podvještine služe samo kao pomoć pri čitanju testa i pisanju bilješke
              razrada: [
                "opisuje i računa kvadrat racionalnog broja",
                "kvadrira umnožak i količnik racionalnih brojeva",
                "razlikuje bazu i eksponent i zapisuje umnožak jednakih faktora u obliku potencije",
                "računa potenciju racionalne baze, uključujući negativnu bazu i eksponent nula",
                "množi i dijeli potencije jednakih baza, potencira potenciju",
                "razlikuje -a² i (-a)²"
              ]
            },
            {
              id: "B.8.1",
              oznaka: "MAT OŠ B.8.1.",
              tekst: "Računa s algebarskim izrazima u R.",
              razrada: [
                "računa vrijednost algebarskog izraza uvrštavanjem zadane vrijednosti",
                "zbraja, oduzima i množi algebarske izraze (monome) s potencijama"
              ]
            }
          ]
        }
      ]
    }
  }
};

// Zadani primjer stila (možeš ga promijeniti u Postavkama). Služi samo za ton, duljinu i izričaj.
window.STIL_PRIMJER = "Učenica poznaje pojmove baze i eksponenta. Zna dijeliti i množiti dva racionalna broja koja prije toga kvadrira. Učenica pravilno primjenjuje pravilo za umnožak kvadrata. Učenica zna što znači potencirati racionalan broj i primjenjuje to u zadatcima. Učenica bi trebala znati izračunati vrijednost algebarskog izraza.";
