const Sequelize = require('sequelize');

var sequelize = new Sequelize('neondb', 'neondb_owner', 'EveDmKG58guN', {
  host: 'ep-shrill-silence-a52t08zu.us-east-2.aws.neon.tech',
  dialect: 'postgres',
  port: 5432,
  dialectOptions: {
    ssl: { rejectUnauthorized: false }
  },
  query: { raw: true }
});

// creating models 
const Category = sequelize.define("Category", {
  categoryID: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  categoryName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

const Item = sequelize.define("item", {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  itemDate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
  price: Sequelize.DOUBLE,
  categoryID: {
    type: Sequelize.INTEGER,
    references: {
      model: Category,
      key: "categoryID",
    },
  },
});

Item.belongsTo(Category, { foreignKey: "categoryID" });

function initialize() {
  try {
    sequelize.sync();
    return Promise.resolve("SYNCED");
  } catch (err) {
    return Promise.reject("COULD NOT SYNC");
  }
}

function getAllItems() {
  return Item.findAll()
    .then(data => data.length ? Promise.resolve(data) : Promise.reject("Could not fetch any items"))
    .catch(err => Promise.reject("no results returned"));
}

function getPublishedItems() {
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        published: true,
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned"));
  });
}

function getCategories() {
  return Category.findAll()
    .then(data => data.length ? Promise.resolve(data) : Promise.reject("no results returned"))
    .catch(err => Promise.reject("no results returned"));
}

function getPublishedItemsByCategory(categoryID){
  return Item.findAll({
    where: {
      categoryID: categoryID,
      published: true,
    },
  })
    .then(data => data.length ? Promise.resolve(data) : Promise.reject("could not find any items"))
    .catch(() => Promise.reject("Error fetching published items by category"));
}

function addItem(itemData) {
  itemData.published = itemData.published;
  itemData.itemDate = new Date();
  itemData.categoryID = parseInt(itemData.categoryID, 10);

  return new Promise((resolve, reject) => {
    Item.create(itemData)
      .then(() => resolve())
      .catch((err) => reject("unable to create item"));
  });
}

//Function to add items by category
const getItemsByCategory = function (category) {
  return new Promise((resolve, reject) => {
    Item.findAll({
      where: {
        categoryID: category,
      },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("no results returned"));
  });
};

// function to get items by minimum date
const { gte } = require('sequelize').Op;
function getItemsByMinDate(minDateStr) {
  return Item.findAll({
    where: {
      itemDate: {
        [gte]: new Date(minDateStr)
      }
    }
  })
    .then(data => data.length ? Promise.resolve(data) : Promise.reject("no results returned"))
    .catch(err => Promise.reject("no results returned"));
}

//Function to get item by ID
const getItemById = function (id) {
  return new Promise((resolve, reject) => {
    Item.findOne({
      where: { id: id }
    })
    .then((item) => {
      if (item) {
        resolve(item);
      } else {
        reject("Did not find the item.");
      }
    })
    .catch((err) => reject("no results returned"));
  });
};

// A-5 Functions ----- tested, working
function addCategory(categoryData) {
  for (const key in categoryData) {
    if (categoryData[key] === "") {
      categoryData[key] = null;
    }
  }

  return Category.create(categoryData)
    .then(data => Promise.resolve(data))
    .catch(err => Promise.reject("unable to create category"));
}


function getCategoryById (id) {
  return new Promise((resolve, reject) => {
    Category.findByPk(id)
      .then((category) => {
        if (category) {
          resolve(category);
        } else {
          resolve(null); 
        }
      })
      .catch((err) => reject(err));
  });
};

function deleteCategoryById(id) {
  return Category.destroy({
    where: { categoryID: id }
  })
    .then(rowsDeleted => {
      if (rowsDeleted === 0) {
        return Promise.reject("No category found with this ID.");
      } else {
        return Promise.resolve("Category deleted successfully.");
      }
    })
    .catch(err => Promise.reject("unable to delete category"));
}

function deleteItemById(id) {
  return Item.destroy({ where: { id } })
    .then((result) => {
      if (result) {
        return Promise.resolve("Item deleted successfully.");
      } else {
        return Promise.reject("Item not found.");
      }
    })
    .catch((err) => Promise.reject(`Unable to remove item: ${err}`));
}

module.exports = {
  initialize,
  getAllItems,
  getPublishedItems,
  getPublishedItemsByCategory,
  getCategories,
  getCategoryById,
  addItem,
  getItemsByCategory,
  getItemById,
  getItemsByMinDate,
  addCategory,
  deleteCategoryById,
  deleteItemById
};
