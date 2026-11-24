// My Kitchen: the ingredient list, the swap table, and the matcher that maps
// each recipe ingredient line to standard ingredient names at build time.
// Used by .eleventy.js (the kitchenRecipes collection) and by kitchen.njk (the
// list a visitor picks from). Run `node scripts/kitchen-audit.js` after editing
// to see which recipe lines still match nothing.
//
// Each entry is "Name: other words that mean it". The name matches too, and a
// plural "s"/"es" is allowed on every word. When two words overlap, the longer
// one wins ("chicken broth" is broth, not chicken; "peanut butter" is not butter).

const GROUPS = {
  "Meat & poultry": [
    "Chicken: chicken breast, chicken thigh, chicken drumstick, drumstick, chicken wing, chicken leg, rotisserie chicken, whole chicken, chicken tender, poussin, chicken mince, ground chicken",
    "Ground beef: minced beef, beef mince, hamburger meat, lean beef, ground chuck",
    "Beef: marrow bone, beef bone, soup bone, steak, sirloin, flank steak, skirt steak, chuck, beef chuck, brisket, short rib, ribeye, rib eye, stewing beef, stew meat, beef stew meat, oxtail, beef roast, roast beef, topside, rump, tenderloin, fillet steak",
    "Pork: pork chop, pork shoulder, pork belly, pork loin, pork tenderloin, pork butt, pork rib, spare rib, baby back rib",
    "Ground pork: minced pork, pork mince",
    "Bacon: pancetta, streaky bacon, bacon rasher",
    "Sausage: chorizo, kielbasa, boerewors, bratwurst, italian sausage, breakfast sausage, sausage meat, hot dog, frankfurter, andouille, linguica",
    "Ham: prosciutto, gammon, deli ham",
    "Salami & pepperoni: salami, pepperoni, mortadella, cured meat, deli meat, cold cuts",
    "Lamb: ground lamb, lamb shoulder, leg of lamb, lamb chop, mutton, lamb mince",
    "Turkey: ground turkey, turkey breast",
    "Duck: duck breast, duck leg",
  ],
  "Fish & seafood": [
    "Salmon: smoked salmon, salmon fillet",
    "White fish: cod, tilapia, haddock, hake, snapper, sea bass, fish fillet, white fish fillet, pollock, halibut, catfish, mahi mahi, firm white fish",
    "Tuna: canned tuna, tuna steak",
    "Shrimp: prawn, king prawn, jumbo shrimp",
    "Crab: crab meat, imitation crab",
    "Mussels",
    "Clams",
    "Squid: calamari",
    "Anchovies: anchovy, anchovy fillet",
    "Sardines: sardine, pilchard",
  ],
  "Dairy & eggs": [
    "Eggs: egg, egg yolk, egg white, large egg",
    "Butter: unsalted butter, salted butter, melted butter",
    "Milk: whole milk, skim milk, 2% milk, low-fat milk, full-cream milk, warm milk",
    "Heavy cream: cream, whipping cream, heavy whipping cream, double cream, single cream, light cream, half-and-half, half and half, thickened cream, whipped cream, fresh cream",
    "Sour cream: crème fraîche, creme fraiche",
    "Buttermilk",
    "Yogurt: yoghurt, greek yogurt, greek yoghurt, plain yogurt, natural yogurt, curd, dahi, labneh",
    "Cream cheese",
    "Cheddar: cheddar cheese, sharp cheddar, mild cheddar",
    "Parmesan: parmigiano, parmigiano-reggiano, parmigiano reggiano, pecorino, pecorino romano, grana padano",
    "Mozzarella: fresh mozzarella, burrata",
    "Feta",
    "Ricotta",
    "Mascarpone",
    "Goat cheese: chevre",
    "Gruyère: gruyere, swiss cheese, emmental, emmentaler",
    "Monterey Jack: pepper jack, jack cheese, colby jack, colby",
    "Cheese: shredded cheese, mexican cheese, mexican blend, cotija, queso fresco, provolone, halloumi, american cheese, cheese slice, gouda, brie, blue cheese, gorgonzola, queso",
    "Paneer",
    "Sweetened condensed milk: condensed milk",
    "Evaporated milk",
    "Ghee: clarified butter",
    "Ice cream: vanilla ice cream",
  ],
  "Vegetables": [
    "Onion: yellow onion, white onion, red onion, brown onion, sweet onion, vidalia onion, pearl onion",
    "Shallot",
    "Green onion: scallion, spring onion, salad onion",
    "Garlic: garlic clove, clove of garlic, cloves of garlic, garlic paste, minced garlic, head of garlic, garlic bulb",
    "Ginger: fresh ginger, ginger root, ginger paste, ginger-garlic paste, ginger garlic paste",
    "Potatoes: potato, russet, yukon gold, baby potato, new potato, red potato, waxy potato, hash brown, fries, french fries, potato chip",
    "Sweet potato: yam, kumara",
    "Carrots: carrot",
    "Celery: celery stalk, celery rib",
    "Bell pepper: red bell pepper, green bell pepper, yellow bell pepper, capsicum, green pepper, red pepper, yellow pepper, roasted red pepper, sweet pepper",
    "Chili pepper: chili, chile, chilli, chilies, chillies, chiles, jalapeño, jalapeno, serrano, thai chili, bird's eye chili, bird's eye chilli, scotch bonnet, habanero, green chili, red chili, poblano, fresno, anaheim, chipotle, chipotle in adobo",
    "Tomatoes: tomato, cherry tomato, grape tomato, roma tomato, plum tomato, beefsteak tomato, vine tomato",
    "Canned tomatoes: crushed tomato, diced tomato, canned tomato, tinned tomato, chopped tomatoes, whole peeled tomato, peeled tomato, san marzano, fire-roasted tomato, can of tomatoes, tin of tomatoes",
    "Tomato paste: tomato purée, tomato puree",
    "Tomato sauce: enchilada sauce, red enchilada sauce, passata, marinara, marinara sauce, pasta sauce, pizza sauce, tomato passata",
    "Sun-dried tomatoes: sun-dried tomato, sundried tomato, sun dried tomato",
    "Spinach: baby spinach",
    "Kale: lacinato kale, cavolo nero, collard greens, collards, swiss chard, chard",
    "Lettuce: romaine, iceberg, butter lettuce, mixed greens, salad greens, salad leaves, arugula, rocket, little gem, lettuce leaf, lettuce leaves, spring mix",
    "Cabbage: napa cabbage, red cabbage, green cabbage, savoy cabbage, coleslaw mix, slaw mix, kimchi, sauerkraut",
    "Bok choy: pak choi, baby bok choy, choy sum, chinese broccoli, gai lan",
    "Broccoli: broccoli floret, broccolini, tenderstem",
    "Cauliflower: cauliflower floret",
    "Zucchini: courgette, summer squash, yellow squash",
    "Eggplant: aubergine, brinjal",
    "Mushrooms: mushroom, shiitake, cremini, crimini, portobello, button mushroom, chestnut mushroom, oyster mushroom, porcini, wood ear",
    "Cucumber: english cucumber, persian cucumber",
    "Corn: sweetcorn, sweet corn, corn kernel, corn on the cob, ear of corn, creamed corn, hominy",
    "Peas: green pea, frozen pea, garden pea, petit pois, snow pea, sugar snap, snap pea, mangetout",
    "Green beans: green bean, string bean, french bean, haricot vert",
    "Asparagus",
    "Avocado: guacamole",
    "Beetroot: beet, beets",
    "Pumpkin: butternut squash, butternut, squash, acorn squash, kabocha",
    "Leek",
    "Radish: daikon",
    "Bean sprouts: bean sprout, mung bean sprout",
    "Okra",
    "Fennel bulb",
    "Water chestnuts: water chestnut, bamboo shoot",
    "Tomatillos: tomatillo",
    "Mixed vegetables: mixed vegetable, frozen vegetable, diced vegetable, chopped vegetable, vegetables, stir-fry vegetables",
  ],
  "Herbs": [
    "Parsley: flat-leaf parsley, italian parsley, curly parsley",
    "Cilantro: coriander leaves, coriander leaf, fresh coriander, coriander sprigs, cilantro leaves",
    "Basil: thai basil, basil leaves",
    "Mint: mint leaves",
    "Dill",
    "Rosemary",
    "Thyme",
    "Chives",
    "Oregano",
    "Sage",
    "Lemongrass: lemon grass",
    "Galangal",
    "Lime leaves: kaffir lime leaf, kaffir lime leaves, makrut lime leaf, makrut lime leaves, lime leaf",
    "Curry leaves: curry leaf",
    "Bay leaves: bay leaf",
  ],
  "Fruit": [
    "Lemon: lemon juice, lemon zest, lemon wedge, lemon peel, lemon rind",
    "Lime: lime juice, lime zest, lime wedge",
    "Orange: orange juice, orange zest, orange peel, mandarin, clementine",
    "Apples: apple, granny smith, apple juice, apple sauce, applesauce",
    "Bananas: banana",
    "Berries: berry, blueberry, blueberries, strawberry, strawberries, raspberry, raspberries, blackberry, blackberries, mixed berries, frozen berries",
    "Mango",
    "Pineapple",
    "Peaches: peach, nectarine, apricot",
    "Pears: pear",
    "Cherries: cherry, maraschino cherry, maraschino cherries",
    "Raisins: raisin, sultana, currant, dried fruit, mixed peel",
    "Dates: date, medjool",
    "Coconut: shredded coconut, desiccated coconut, coconut flake, flaked coconut",
    "Cranberries: cranberry, dried cranberries, dried cranberry",
    "Grapes: grape",
    "Pomegranate: pomegranate seeds",
    "Passion fruit: granadilla",
  ],
  "Rice, pasta & bread": [
    "Rice: basmati, jasmine rice, long-grain rice, long grain rice, arborio, sushi rice, white rice, brown rice, cooked rice, short-grain rice, glutinous rice, sticky rice, risotto rice, rice grain",
    "Pasta: spaghetti, penne, macaroni, elbow macaroni, fettuccine, fettucine, linguine, lasagna, lasagne, lasagna noodles, lasagna sheet, rigatoni, fusilli, orzo, farfalle, bow tie pasta, tagliatelle, pappardelle, ziti, rotini, shells, gnocchi, tortellini, ravioli, angel hair, bucatini, orecchiette, ditalini",
    "Noodles: rice noodle, egg noodle, ramen, udon, soba, vermicelli, rice vermicelli, glass noodle, cellophane noodle, rice stick, lo mein, chow mein noodle, wheat noodle, pad thai noodle",
    "Bread: baguette, sourdough, brioche, bun, dinner roll, toast, crouton, loaf, loaves, ciabatta, sandwich bread, white bread, hamburger bun, burger bun, hoagie, sub roll, hot dog bun, crusty bread, bread slice, slice of bread, english muffin, bagel, croissant, challah, french bread, bread roll, kaiser roll",
    "Pita: pita bread, pitta, naan bread, flatbread, naan, roti, chapati, lavash",
    "Tortillas: tortilla, flour tortilla, corn tortilla, wrap, taco shell, tostada, tortilla chip",
    "Oats: rolled oats, old-fashioned oats, oatmeal, quick oats, steel-cut oats, porridge oats, granola, muesli",
    "Couscous",
    "Quinoa",
    "Bulgur: bulgur wheat, bulghur, cracked wheat",
    "Barley: pearl barley",
    "Cornmeal: polenta, maize meal, mealie meal, masa harina, grits, semolina",
    "Breadcrumbs: breadcrumb, panko, bread crumbs, panko breadcrumbs, dried breadcrumbs, matzo meal, tenkasu, tempura scraps",
    "Pastry: pie crust, puff pastry, phyllo, filo, phyllo dough, filo pastry, shortcrust pastry, pie dough, pastry sheet, pie shell",
    "Biscuits & crackers: graham cracker, digestive biscuit, digestive, tennis biscuit, marie biscuit, biscuit, cracker, ladyfinger, savoiardi, oreo, cookie crumb, saltine, ritz",
    "Rice paper: rice paper wrapper, spring roll wrapper",
    "Wonton wrappers: wonton wrapper, dumpling wrapper, gyoza wrapper, egg roll wrapper",
  ],
  "Baking": [
    "Flour: all-purpose flour, plain flour, bread flour, cake flour, self-raising flour, self-rising flour, whole wheat flour, wholemeal flour, pastry flour, rice flour, chickpea flour, gram flour, besan, cake wheat flour, strong flour",
    "Sugar: granulated sugar, white sugar, caster sugar, superfine sugar, cane sugar",
    "Brown sugar: light brown sugar, dark brown sugar, packed brown sugar, palm sugar, coconut sugar, demerara, muscovado, jaggery, turbinado",
    "Powdered sugar: icing sugar, confectioners sugar, confectioners' sugar, confectioner's sugar",
    "Baking powder",
    "Baking soda: bicarbonate of soda, bicarb, bicarb soda, sodium bicarbonate",
    "Yeast: active dry yeast, instant yeast, dry yeast",
    "Vanilla: vanilla extract, vanilla essence, vanilla bean, vanilla pod, vanilla paste",
    "Cocoa powder: cocoa, unsweetened cocoa powder, dutch-process cocoa, cacao powder",
    "Chocolate: chocolate chip, chocolate chips, dark chocolate, semi-sweet chocolate, semisweet chocolate, milk chocolate, white chocolate, bittersweet chocolate, chocolate bar, choc chip, peppermint crisp",
    "Cornstarch: corn starch, cornflour, corn flour, potato starch, tapioca starch, arrowroot",
    "Honey",
    "Maple syrup: maple",
    "Golden syrup: corn syrup, light corn syrup, simple syrup, caramel, dulce de leche, treacle",
    "Molasses",
    "Gelatin: gelatine",
    "Almonds: almond, ground almond, almond flour, almond meal, slivered almond, flaked almond, almond extract",
    "Walnuts: walnut",
    "Pecans: pecan",
    "Peanuts: peanut, roasted peanut",
    "Cashews: cashew",
    "Pistachios: pistachio",
    "Pine nuts: pine nut",
    "Hazelnuts: hazelnut, nutella",
    "Peanut butter",
    "Sesame seeds: sesame seed, toasted sesame seeds",
    "Seeds: chia seed, pepita, pumpkin seed, sunflower seed, flaxseed, linseed, hemp seed",
    "Marshmallows: marshmallow, marshmallow fluff",
    "Sprinkles: food coloring, food colouring, chocolate sprinkles, vermicelli sprinkles",
  ],
  "Cans, jars & broth": [
    "Chicken broth: chicken stock, stock, broth, bouillon, stock cube, bouillon cube, chicken bouillon",
    "Beef broth: beef stock, beef bouillon, bone broth",
    "Vegetable broth: vegetable stock, veg stock, veggie broth",
    "Coconut milk: coconut cream, full-fat coconut milk, light coconut milk",
    "Black beans: black bean",
    "Kidney beans: kidney bean, red kidney bean, pinto bean, pinto beans",
    "Chickpeas: chickpea, garbanzo, garbanzo bean, chana",
    "White beans: cannellini, cannellini bean, white bean, navy bean, butter bean, great northern bean, lima bean, haricot bean",
    "Lentils: lentil, red lentil, green lentil, brown lentil, dal, dhal, toor dal, masoor dal, moong dal, split pea, urad dal",
    "Baked beans: baked bean",
    "Refried beans: refried bean",
    "Olives: olive, kalamata, black olive, green olive",
    "Capers: caper",
    "Pickles: pickle, gherkin, dill pickle, relish, pickle relish, pickled jalapeño, pickled jalapeno, cornichon",
    "Pesto",
    "Salsa: pico de gallo, salsa verde",
    "Jam: jelly, preserves, apricot jam, strawberry jam, marmalade",
    "Tahini",
    "Condensed soup: cream of chicken soup, cream of mushroom soup, cream of celery soup, condensed soup, cream of chicken, cream of mushroom",
    "Salad dressing: caesar dressing, italian dressing, ranch, ranch dressing, thousand island, russian dressing, vinaigrette, blue cheese dressing",
  ],
  "Sauces & condiments": [
    "Soy sauce: soy, light soy sauce, dark soy sauce, tamari, kecap manis, sweet soy sauce",
    "Fish sauce",
    "Oyster sauce",
    "Hoisin sauce: hoisin",
    "Hot sauce: sriracha, tabasco, chili sauce, chilli sauce, sambal, sambal oelek, chili oil, chilli oil, chili garlic sauce, sweet chili sauce, sweet chilli sauce, peri-peri sauce, harissa",
    "Chili paste: gochujang, gochugaru, korean chili paste, doubanjiang, chili bean paste, broad bean paste, spicy bean paste",
    "Worcestershire sauce: worcestershire",
    "Ketchup: tomato ketchup",
    "Mayonnaise: mayo, aioli",
    "Mustard: dijon, dijon mustard, yellow mustard, wholegrain mustard, whole grain mustard, english mustard, dry mustard, mustard powder, honey mustard",
    "Vinegar: white vinegar, rice vinegar, apple cider vinegar, cider vinegar, red wine vinegar, white wine vinegar, balsamic, balsamic vinegar, sherry vinegar, malt vinegar, distilled vinegar, black vinegar, chinkiang vinegar, rice wine vinegar",
    "Sesame oil: toasted sesame oil",
    "Mirin",
    "Rice wine: shaoxing, shaoxing wine, chinese cooking wine, cooking wine, sake, dry sherry",
    "Wine: white wine, red wine, dry white wine, dry red wine, marsala, port, brandy, rum, bourbon, whiskey, vodka, liqueur, kahlua, sherry",
    "Beer: lager, stout, ale",
    "Curry paste: red curry paste, green curry paste, yellow curry paste, massaman curry paste, massaman paste, thai curry paste, panang curry paste, rendang paste, laksa paste, aji amarillo, aji amarillo paste, curry base",
    "BBQ sauce: barbecue sauce, bbq",
    "Chutney: mango chutney, apricot chutney, peach chutney",
    "Miso: miso paste, white miso, red miso, doenjang",
    "Tamarind: tamarind paste, tamarind concentrate",
    "Coffee: espresso, instant coffee, coffee granules, brewed coffee",
    "Tea: tea bag, black tea, green tea, matcha",
    "Tofu: firm tofu, silken tofu, extra-firm tofu",
  ],
  "Spices & seasonings": [
    "Cumin: ground cumin, cumin seed, cumin powder, roasted cumin powder, jeera",
    "Ground coriander: coriander, coriander powder, coriander seed, dhania powder",
    "Paprika: smoked paprika, sweet paprika, hot paprika, pimentón",
    "Chili powder: red chili powder, kashmiri chili powder, kashmiri red chili powder, chilli powder, ancho chili powder, chipotle powder, red chilli powder",
    "Cayenne: cayenne pepper",
    "Chili flakes: red pepper flakes, crushed red pepper, chilli flakes, red chili flakes, crushed red pepper flakes, aleppo pepper",
    "Turmeric: ground turmeric, turmeric powder, haldi",
    "Garam masala",
    "Curry powder: madras curry powder, masala, curry masala, chaat masala, tandoori masala, biryani masala, chana masala powder",
    "Cinnamon: ground cinnamon, cinnamon stick",
    "Nutmeg: ground nutmeg",
    "Cloves: clove, ground cloves, whole cloves",
    "Ground ginger: ginger powder, dried ginger",
    "Cardamom: cardamom pod, green cardamom, ground cardamom, black cardamom",
    "Star anise",
    "Allspice: pimento",
    "Italian seasoning: mixed herbs, herbes de provence, dried herbs, mixed dried herbs",
    "Garlic powder: garlic granules, granulated garlic, garlic salt",
    "Onion powder: onion granules, dried onion, onion flakes, onion salt",
    "Five-spice: five spice, chinese five spice, five-spice powder",
    "Fennel seeds: fennel seed, fennel, saunf",
    "Mustard seeds: mustard seed, black mustard seeds",
    "Fenugreek: kasuri methi, methi, fenugreek seeds, fenugreek leaves",
    "Saffron",
    "Sumac",
    "Za'atar: zaatar",
    "Cajun seasoning: creole seasoning, cajun, old bay, blackening seasoning",
    "Taco seasoning: fajita seasoning, mexican seasoning",
    "Amchur: amchoor, dried mango powder, mango powder",
    "Asafoetida: hing",
    "Sichuan peppercorns: sichuan peppercorn, szechuan peppercorn, szechuan peppercorns",
    "Ras el hanout: berbere, baharat, dukkah",
    "Peri-peri seasoning: peri-peri, piri piri, braai spice, steak seasoning, chicken spice, seasoning salt, seasoned salt, aromat, montreal steak seasoning, all-purpose seasoning",
    "Caraway seeds: caraway",
    "Nigella seeds: nigella, kalonji",
    "Juniper: juniper berries, juniper berry",
    "Seaweed & dashi: msg, kelp, dried kelp, chicken powder, dashi, hondashi, bonito flakes, kombu, nori, seaweed",
  ],
  "Basics": [
    "Salt: kosher salt, sea salt, table salt, flaky salt, fine salt, flaky sea salt, coarse salt",
    "Black pepper: pepper, ground pepper, ground black pepper, white pepper, peppercorn, black peppercorn, cracked pepper",
    "Oil: vegetable oil, olive oil, extra-virgin olive oil, extra virgin olive oil, canola oil, neutral oil, cooking oil, sunflower oil, peanut oil, avocado oil, coconut oil, corn oil, light olive oil, rapeseed oil, grapeseed oil, frying oil, cooking spray, nonstick spray",
    "Water: ice, ice cube, boiling water, cold water, warm water, hot water",
  ],
};

// Assumed on hand unless the visitor turns that off.
const STAPLES = ["Salt", "Black pepper", "Oil", "Water"];

// [missing, what you could use instead, how]. A swap counts as "you can make
// it" only when you have the replacement; otherwise it shows as a tip.
// shortcut: hand-written and partial, add to it when a common gap shows up.
const SWAPS = [
  ["Buttermilk", "Milk", "milk with 1 tbsp lemon juice or vinegar per cup, left 5 minutes"],
  ["Buttermilk", "Yogurt", "yogurt thinned with a little milk or water"],
  ["Sour cream", "Yogurt", "plain or Greek yogurt"],
  ["Yogurt", "Sour cream", "sour cream"],
  ["Heavy cream", "Milk", "milk with melted butter (3/4 cup milk + 1/4 cup butter); won't whip"],
  ["Heavy cream", "Evaporated milk", "evaporated milk in sauces and soups"],
  ["Milk", "Evaporated milk", "evaporated milk mixed half and half with water"],
  ["Evaporated milk", "Milk", "milk simmered down by about half"],
  ["Milk", "Heavy cream", "cream thinned with water"],
  ["Butter", "Oil", "oil, about 3/4 the amount (fine for cooking, changes baking)"],
  ["Butter", "Ghee", "ghee"],
  ["Ghee", "Butter", "butter"],
  ["Ghee", "Oil", "oil"],
  ["Chicken", "Turkey", "turkey"],
  ["Ground beef", "Ground pork", "ground pork"],
  ["Ground beef", "Turkey", "ground turkey"],
  ["Ground beef", "Lamb", "ground lamb"],
  ["Ground pork", "Ground beef", "ground beef"],
  ["Ground pork", "Sausage", "sausage meat out of its casing"],
  ["Bacon", "Ham", "ham, fried until crisp"],
  ["Bacon", "Sausage", "chopped sausage or chorizo"],
  ["Beef", "Lamb", "lamb"],
  ["Pork", "Chicken", "chicken thighs"],
  ["Shrimp", "Chicken", "chicken, cut small"],
  ["White fish", "Salmon", "salmon"],
  ["Salmon", "White fish", "white fish"],
  ["Chicken broth", "Vegetable broth", "vegetable broth"],
  ["Chicken broth", "Beef broth", "beef broth"],
  ["Beef broth", "Chicken broth", "chicken broth"],
  ["Vegetable broth", "Chicken broth", "chicken broth"],
  ["Beef broth", "Vegetable broth", "vegetable broth"],
  ["Lemon", "Lime", "lime"],
  ["Lime", "Lemon", "lemon"],
  ["Lemon", "Vinegar", "a little vinegar for the sourness"],
  ["Onion", "Shallot", "shallots"],
  ["Shallot", "Onion", "onion"],
  ["Onion", "Onion powder", "onion powder, about 1 tsp per onion"],
  ["Green onion", "Onion", "a little finely chopped onion"],
  ["Green onion", "Chives", "chives"],
  ["Garlic", "Garlic powder", "garlic powder, 1/4 tsp per clove"],
  ["Ginger", "Ground ginger", "ground ginger, 1/4 tsp per tbsp fresh"],
  ["Cilantro", "Parsley", "parsley"],
  ["Parsley", "Cilantro", "cilantro"],
  ["Basil", "Italian seasoning", "dried herbs, a third of the amount"],
  ["Oregano", "Italian seasoning", "Italian seasoning"],
  ["Thyme", "Italian seasoning", "Italian seasoning"],
  ["Rosemary", "Italian seasoning", "Italian seasoning"],
  ["Tomatoes", "Canned tomatoes", "canned tomatoes"],
  ["Canned tomatoes", "Tomatoes", "fresh tomatoes, chopped and cooked down"],
  ["Canned tomatoes", "Tomato sauce", "tomato sauce or passata"],
  ["Tomato sauce", "Canned tomatoes", "canned tomatoes, blended"],
  ["Tomato sauce", "Tomato paste", "tomato paste thinned with water"],
  ["Tomato paste", "Ketchup", "ketchup (sweeter)"],
  ["Tomato paste", "Tomato sauce", "tomato sauce, cooked down"],
  ["Spinach", "Kale", "kale"],
  ["Kale", "Spinach", "spinach"],
  ["Zucchini", "Eggplant", "eggplant"],
  ["Sweet potato", "Pumpkin", "butternut or pumpkin"],
  ["Pumpkin", "Sweet potato", "sweet potato"],
  ["Potatoes", "Sweet potato", "sweet potato"],
  ["Bell pepper", "Chili pepper", "a mild chili"],
  ["Chili pepper", "Chili flakes", "chili flakes"],
  ["Chili pepper", "Hot sauce", "a few drops of hot sauce"],
  ["Chili flakes", "Cayenne", "a pinch of cayenne"],
  ["Cayenne", "Chili flakes", "chili flakes"],
  ["Cayenne", "Chili powder", "chili powder"],
  ["Chili powder", "Cayenne", "cayenne, less of it"],
  ["Chili powder", "Paprika", "paprika (milder)"],
  ["Paprika", "Chili powder", "chili powder (hotter)"],
  ["Ground coriander", "Cumin", "cumin"],
  ["Garam masala", "Curry powder", "curry powder"],
  ["Curry powder", "Garam masala", "garam masala with a pinch of turmeric"],
  ["Allspice", "Cinnamon", "cinnamon with a pinch of nutmeg and cloves"],
  ["Nutmeg", "Cinnamon", "cinnamon"],
  ["Rice", "Quinoa", "quinoa"],
  ["Rice", "Couscous", "couscous"],
  ["Pasta", "Noodles", "noodles"],
  ["Noodles", "Pasta", "spaghetti or linguine"],
  ["Tortillas", "Pita", "flatbread"],
  ["Pita", "Tortillas", "tortillas"],
  ["Bread", "Pita", "flatbread"],
  ["Breadcrumbs", "Bread", "dry bread, blitzed"],
  ["Breadcrumbs", "Oats", "oats, blitzed"],
  ["Breadcrumbs", "Biscuits & crackers", "crushed crackers"],
  ["Sugar", "Brown sugar", "brown sugar"],
  ["Brown sugar", "Sugar", "sugar with 1 tbsp molasses or honey per cup"],
  ["Sugar", "Honey", "honey, 3/4 the amount, with a little less liquid"],
  ["Honey", "Maple syrup", "maple syrup"],
  ["Maple syrup", "Honey", "honey"],
  ["Honey", "Golden syrup", "golden or corn syrup"],
  ["Golden syrup", "Honey", "honey"],
  ["Molasses", "Brown sugar", "dark brown sugar"],
  ["Powdered sugar", "Sugar", "sugar blitzed fine in a blender"],
  ["Baking powder", "Baking soda", "1/4 tsp baking soda + 1/2 tsp lemon juice or vinegar per 1 tsp"],
  ["Cornstarch", "Flour", "flour, twice the amount"],
  ["Flour", "Cornstarch", "cornstarch, half the amount (for thickening only)"],
  ["Vanilla", "Maple syrup", "a little maple syrup"],
  ["Chocolate", "Cocoa powder", "3 tbsp cocoa + 1 tbsp butter per 1 oz (30 g)"],
  ["Soy sauce", "Fish sauce", "fish sauce, a little less"],
  ["Soy sauce", "Worcestershire sauce", "Worcestershire, a little less"],
  ["Fish sauce", "Soy sauce", "soy sauce with a squeeze of lime"],
  ["Oyster sauce", "Hoisin sauce", "hoisin sauce"],
  ["Oyster sauce", "Soy sauce", "soy sauce with a pinch of sugar"],
  ["Hoisin sauce", "BBQ sauce", "barbecue sauce"],
  ["Hoisin sauce", "Oyster sauce", "oyster sauce with a little honey"],
  ["Mirin", "Rice wine", "rice wine or dry sherry with a pinch of sugar"],
  ["Mirin", "Vinegar", "rice vinegar with 1/2 tsp sugar per tbsp"],
  ["Rice wine", "Wine", "dry white wine or sherry"],
  ["Rice wine", "Mirin", "mirin (sweeter)"],
  ["Wine", "Chicken broth", "broth with a splash of vinegar"],
  ["Wine", "Vinegar", "a splash of vinegar in water"],
  ["Chili paste", "Hot sauce", "sriracha with a little miso or soy"],
  ["Hot sauce", "Chili flakes", "chili flakes"],
  ["Hot sauce", "Cayenne", "a pinch of cayenne"],
  ["Mustard", "Mayonnaise", "mayonnaise (milder)"],
  ["Mayonnaise", "Yogurt", "Greek yogurt"],
  ["Mayonnaise", "Sour cream", "sour cream"],
  ["Sesame oil", "Oil", "oil (less nutty)"],
  ["Coconut milk", "Heavy cream", "cream"],
  ["Coconut milk", "Yogurt", "yogurt stirred in off the heat"],
  ["Cream cheese", "Mascarpone", "mascarpone"],
  ["Mascarpone", "Cream cheese", "cream cheese"],
  ["Ricotta", "Cream cheese", "cream cheese"],
  ["Ricotta", "Feta", "crumbled feta"],
  ["Parmesan", "Cheddar", "a sharp cheddar"],
  ["Cheddar", "Cheese", "another melting cheese"],
  ["Cheddar", "Monterey Jack", "Monterey Jack"],
  ["Monterey Jack", "Cheddar", "cheddar"],
  ["Mozzarella", "Cheese", "another melting cheese"],
  ["Mozzarella", "Cheddar", "cheddar"],
  ["Gruyère", "Cheddar", "cheddar"],
  ["Cheese", "Cheddar", "cheddar"],
  ["Feta", "Goat cheese", "goat cheese"],
  ["Goat cheese", "Feta", "feta"],
  ["Paneer", "Tofu", "firm tofu"],
  ["Vinegar", "Lemon", "lemon juice"],
  ["Black beans", "Kidney beans", "kidney or pinto beans"],
  ["Kidney beans", "Black beans", "black beans"],
  ["White beans", "Chickpeas", "chickpeas"],
  ["Chickpeas", "White beans", "white beans"],
  ["Pecans", "Walnuts", "walnuts"],
  ["Walnuts", "Pecans", "pecans"],
  ["Almonds", "Cashews", "cashews"],
  ["Peanuts", "Cashews", "cashews"],
  ["Oats", "Flour", "flour (for crumble toppings)"],
  ["Berries", "Bananas", "banana"],
];

// ---------- the matcher ----------

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'");

// [{ name, group }]; the index is the id used in the built page.
const INGREDIENTS = [];
const TERMS = []; // [{ id, re, len }], longest first
for (const [group, lines] of Object.entries(GROUPS)) {
  for (const line of lines) {
    const [name, rest = ""] = line.split(/:\s*/);
    const id = INGREDIENTS.push({ name, group }) - 1;
    for (const word of [name, ...rest.split(",")].map((w) => fold(w.trim())).filter(Boolean)) {
      TERMS.push({ id, word, len: word.length, re: new RegExp(`(?<![a-z])${escape(word)}(?:e?s)?(?![a-z])`, "g") });
    }
  }
}
TERMS.sort((a, b) => b.len - a.len);

const byName = new Map(INGREDIENTS.map((x, i) => [x.name, i]));
const idOf = (name) => {
  if (!byName.has(name)) throw new Error(`kitchen: unknown ingredient "${name}"`);
  return byName.get(name);
};

// Every ingredient mentioned in `text`, longest words first, each spot used once.
function findIds(text) {
  let s = fold(text);
  const ids = [];
  for (const t of TERMS) {
    if (!s.includes(t.word)) continue; // cheap check first: skips ~99% of the regexes
    s = s.replace(t.re, (m) => {
      if (!ids.includes(t.id)) ids.push(t.id);
      return " ".repeat(m.length);
    });
  }
  return ids;
}

// Lines that are kit, not food.
const EQUIPMENT = /\b(skewers?|toothpicks?|kitchen (string|twine)|parchment|baking paper|cupcake liners?|muffin cases?)\b/i;

// One recipe line -> { ids, choice, optional }. Several ids mean "any of these"
// when the line offers a choice ("honey or maple syrup") and "all of these"
// otherwise ("salt and pepper"). Words in brackets only count when nothing
// outside them matches ("amchur (dried mango powder)" is not mango).
function matchLine({ item = "", amount = "" }) {
  item = String(item);
  amount = String(amount);
  if (EQUIPMENT.test(item)) return { ids: [], choice: false, optional: true };
  let text = item.replace(/\([^)]*\)/g, " ");
  let ids = findIds(text);
  if (!ids.length) ids = findIds((text = item));
  const optional = /\boptional\b/i.test(item) || /^(to|for) /i.test(amount.trim()) || /\b(for (serving|garnish|dusting)|to serve|to garnish|garnish)\b/i.test(item);
  const choice = /\bor\b|\//i.test(text);
  return { ids, choice, optional };
}

// A recipe -> compact form for the page: n = needed lines, o = optional lines
// (each a list of ids, "any of"), x = needed lines that matched nothing.
function recipeKitchen(ingredients) {
  const n = [], o = [], x = [];
  for (const ing of ingredients || []) {
    const { ids, choice, optional } = matchLine(ing);
    if (!ids.length) {
      if (!optional) x.push(String(ing.item || "").trim());
      continue;
    }
    const groups = choice ? [ids] : ids.map((id) => [id]);
    for (const g of groups) {
      const list = optional ? o : n;
      if (!list.some((h) => h.length === g.length && h.every((v, i) => v === g[i]))) list.push(g);
    }
  }
  return { n, o, x };
}

// What the page needs to draw the picker and work out swaps.
function pageData() {
  return {
    items: INGREDIENTS.map((x) => [x.name, x.group]),
    // alias words per ingredient, so the search finds "aubergine" or "prawn"
    words: Object.values(GROUPS).flat().map((line) => (line.split(/:\s*/)[1] || "")),
    staples: STAPLES.map(idOf),
    swaps: SWAPS.map(([miss, use, how]) => [idOf(miss), idOf(use), how]),
  };
}

module.exports = { GROUPS, INGREDIENTS, STAPLES, SWAPS, matchLine, recipeKitchen, pageData, findIds };
