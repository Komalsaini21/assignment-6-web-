/********************************************************************************
* WEB322 – Assignment 06
*
* I declare that this assignment is my own work in accordance with Seneca's
* Academic Integrity Policy:
*
* https://www.senecacollege.ca/about/policies/academic-integrity-policy.html
*
* Name: Komalpreet kaur Student ID: 144175221     Date: 16-08-2024
*
* Published URL: https://github.com/Komalsaini21/assignment-6-web-.git
*
********************************************************************************/

const express = require("express");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const storeService = require("./store-service");
const authData = require('./auth-service.js');
const exphbs = require("express-handlebars");
const clientSessions = require('client-sessions');
const pg = require('pg'); // this is for vercel

// Cloudinary configuration
cloudinary.config({
  cloud_name: "drzjehajx",
  api_key: "268187625862583",
  api_secret: "8DyuleD0KTHMk6VcvfKoddmuABg",
  secure: true,
});

// Multer upload setup
const upload = multer();

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 8080; 

// Middleware
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use(clientSessions({
  cookieName: 'session',
  secret: 'login_secret',
  duration: 24 * 60 * 60 * 1000, 
  activeDuration: 30 * 60 * 1000 
}));
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (req.session.user) {
      next();
  } else {
      res.redirect('/login');
  }
}

// Navbar active helpers and other hbs functions
app.use((req, res, next) => {
  let route = req.path.substring(1);
  app.locals.activeRoute =
    "/" +
    (isNaN(route.split("/")[1])
      ? route.replace(/\/(?!.*)/, "")
      : route.replace(/\/(.*)/, ""));
  app.locals.viewingCategory = req.query.category;
  next();
});

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    defaultLayout: "main",
    helpers: {
      navLink: function (url, options) {
        return (
          '<li class="nav-item"><a ' +
          (url === app.locals.activeRoute
            ? ' class="nav-link active"'
            : 'class="nav-link"') +
          ' href="' +
          url +
          '">' +
          options.fn(this) +
          "</a></li>"
        );
      },
      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3)
          throw new Error("Handlebars Helper equal needs 2 parameters");
        if (lvalue !== rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      },
      formatDate: function (dateObj) {
        let year = dateObj.getFullYear();
        let month = (dateObj.getMonth() + 1).toString();
        let day = dateObj.getDate().toString();
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      },
    },
  })
);

// Routes
app.get("/", (req, res) => {
  res.redirect("/shop");
});

app.get("/about", (req, res) => {
  res.render("about");
});

// Rendering shop page
app.get("/shop", async (req, res) => {
  let localItems = {};

  try {
    let items = [];
    if (req.query.category) {
      items = await storeService.getPublishedItemsByCategory(req.query.category);
    } else {
      items = await storeService.getPublishedItems();
    }
    items.sort((a, b) => new Date(b.itemDate) - new Date(a.itemDate));
    let post = items[0];
    localItems.items = items;
    localItems.item = post;
  } catch (err) {
    localItems.message = "no result";
  }

  try {
    let categories = await storeService.getCategories();
    localItems.categories = categories;
  } catch (err) {
    localItems.categoriesMessage = "no result";
  }
  res.render("shop", { data: localItems });
});

app.get('/shop/:id', async (req, res) => {
  let localItems = {};

  try {
    const item = await storeService.getItemById(req.params.id);
    if (!item || !item.published) {
      localItems.message = `no results found`;
    } else {
      localItems.item = item;

      const category = await storeService.getCategoryById(item.categoryID);
      localItems.item.categoryName = category ? category.categoryName : 'Unknown';
    }
  } catch (err) {
    localItems.message = "err occurred";
  }

  try {
    const items = req.query.category
      ? await storeService.getPublishedItemsByCategory(req.query.category)
      : await storeService.getPublishedItems();
    items.sort((a, b) => new Date(b.itemDate) - new Date(a.itemDate));
    localItems.items = items;
  } catch (err) {
    localItems.message = "No results for items";
  }

  try {
    const categories = await storeService.getCategories();
    localItems.categories = categories;
  } catch (err) {
    localItems.categoriesMessage = "No results for categories";
  }

  res.render("shop", { data: localItems });
});

// GET all items
app.get("/items", ensureLogin,async(req, res) => {
  try {
    let items;
    if (req.query.category) {
        items = await storeService.getItemsByCategory(req.query.category);
    } else if (req.query.minDate) {
        items = await storeService.getItemsByMinDate(req.query.minDate);
    } else {
        items = await storeService.getAllItems();
    }
    const categories = await storeService.getCategories();
    const categoryMap = categories.reduce((map, category) => {
        map[category.categoryID] = category.categoryName;
        return map;
    }, {});
    items = items.map(item => ({
        ...item,
        categoryName: categoryMap[item.categoryID] || 'UNKNOWN'
    }));

    res.render("items", { items });
} catch (err) {
    res.render("items", { message: "empty" });
}
});

// GET all categories -- Rendering categories.hbs page now
app.get("/categories", ensureLogin,(req, res) => {
  storeService
    .getCategories()
    .then((data) => {
      if (data.length > 0) {
        res.render("categories", { categories: data });
      } else {
        res.render("categories", { message: "no results" });
      }
    })
    .catch((err) => res.status(500).render("categories", { message: "empty" }));
});

// GET item by ID
app.get("/item/:id", ensureLogin,(req, res) => {
  const { id } = req.params;
  storeService
    .getItemById(id)
    .then((item) => res.json(item))
    .catch((err) => {
      res.status(404).send(err);
    });
});

// Serve form for adding an item
app.get("/items/add", ensureLogin,(req, res) => {
  storeService.getCategories()
    .then(categories => {
      res.render('addItem', { categories });
    })
    .catch(err => {
      res.render('addItem', { categories: [] });
    });
});

app.get("/items/delete/:id", ensureLogin,(req, res) => {
  storeService
    .deleteItemById(req.params.id)
    .then(() => res.redirect("/items"))
    .catch(() => res.status(500).send("Unable to Remove Item / Item not found"));
});

// POST to add an item
app.post("/items/add", ensureLogin,upload.single("featureImage"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      try {
        let result = await streamUpload(req);
        console.log(result);
        return result;
      } catch (error) {
        console.error(error);
        throw new Error("Image upload failed");
      }
    }

    upload(req)
      .then((uploaded) => processItem(uploaded.url))
      .catch((error) => {
        console.error(error);
        res.status(500).send("Image upload failed");
      });
  } else {
    processItem("");
  }

  function processItem(imageUrl) {
    req.body.featureImage = imageUrl;

    // Use addItem function from storeService to add the new item
    storeService
      .addItem(req.body)
      .then(() => {
        res.redirect("/items");
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }
});

// A5 routes - Tested
app.get("/categories/add", ensureLogin,(req, res) => {
  res.render("addCategory");
});

app.post("/categories/add", ensureLogin,(req, res) => {
  storeService
    .addCategory(req.body)
    .then(() => res.redirect("/categories"))
    .catch((err) => res.status(500).send(err));
});

app.get("/categories/delete/:id", ensureLogin,(req, res) => {
  storeService
    .deleteCategoryById(req.params.id)
    .then(() => res.redirect("/categories"))
    .catch(() => res.status(500).send("Unable to Remove Category / Category not found"));
  });
  
  app.get('/login', (req, res) => {
    res.render('login');
  });
  
  app.get('/register', (req, res) => {
    res.render('register');
  });

app.post('/login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');

  authData.checkUser(req.body)
    .then(user => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory
      };
      res.redirect('/items');
    })
    .catch(err => {
      console.error("Login error: ", err);  // Log the error
      res.render('login', { errorMessage: err, userName: req.body.userName });
    });
});

app.post('/register', (req, res) => {
  authData.registerUser(req.body)
    .then(() => {
      res.render('register', { successMessage: "User created" });
    })
    .catch(err => {
      console.error("Registration error: ", err);  // Log the error
      res.render('register', { errorMessage: err, userName: req.body.userName });
    });
});


app.get('/userHistory', ensureLogin, (req, res) => {
  res.render('userHistory');
});

app.get('/logout', (req, res) => {
  req.session.reset();
  res.redirect('/');
});

// 404 Error handling
app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

// Initialize store service and start server
storeService.initialize()
.then(authData.initialize)
.then(function(){
    app.listen(HTTP_PORT, function(){
        console.log("app listening on: " + HTTP_PORT)
    });
}).catch(function(err){
    console.log("unable to start server: " + err);
});

module.exports = app;
