const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { v1: uuid } = require("uuid");
const { GraphQLError } = require("graphql");

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const Person = require("./models/person");
const User = require("./models/user");
const Book = require("./models/book");
const Author = require("./models/author");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log("connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("connected to MongoDB");
    // checkDatabase3();
    // checkAuthorsExistence();
    // fixBooks();
  })
  .catch((error) => {
    console.log("error connection to MongoDB:", error.message);
  });

async function checkDatabase() {
  try {
    // Find all books and populate author details
    const books = await Book.find({}).populate("author");
    console.log("All books:", JSON.stringify(books, null, 2));

    // Find all authors
    const authors = await Author.find({});
    console.log("All authors:", JSON.stringify(authors, null, 2));

    // Find books with missing authors
    const booksWithoutAuthors = await Book.find({ author: null });
    console.log(
      "Books without authors:",
      JSON.stringify(booksWithoutAuthors, null, 2)
    );

    const defaultAuthor = await Author.findOne();
    await Book.updateMany(
      { author: null },
      { $set: { author: defaultAuthor._id } }
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

async function checkDatabase2() {
  try {
    // Check for null, undefined, missing, or invalid ObjectId
    const problematicBooks = await Book.find({
      $or: [
        { author: null },
        { author: { $exists: false } },
        { author: "" },
        { author: { $not: { $type: "objectId" } } },
      ],
    });
    console.log(
      "Problematic books:",
      JSON.stringify(problematicBooks, null, 2)
    );

    // Let's also look at all books and their author fields specifically
    const allBooks = await Book.find({});
    console.log(
      "All books authors:",
      allBooks.map((book) => ({
        title: book.title,
        authorField: book.author,
        authorType: typeof book.author,
      }))
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

async function checkDatabase3() {
  try {
    // First, let's just see all books with minimal processing
    const allBooks = await Book.find({});
    console.log("All books:");
    allBooks.forEach((book) => {
      console.log({
        title: book.title,
        authorId: book.author,
        hasAuthor: !!book.author,
      });
    });

    // Now let's try to find problematic entries without casting
    const problematicBooks = await Book.find({
      $or: [{ author: { $exists: false } }, { author: null }],
    }).lean(); // lean() returns plain JavaScript objects

    console.log("\nProblematic books:", problematicBooks);

    // Let's also try to update the problematic entries
    if (problematicBooks.length > 0) {
      console.log(
        "\nFound problematic books. Would you like me to provide the update query to fix them?"
      );
    }
  } catch (error) {
    console.error("Database check error:", error.message);
  }
}

async function checkAuthorsExistence() {
  try {
    // Get all books
    const books = await Book.find({});

    console.log("\nChecking author existence for each book:");
    for (const book of books) {
      const author = await Author.findById(book.author);
      console.log({
        bookTitle: book.title,
        authorId: book.author,
        authorExists: !!author,
        authorData: author,
      });
    }

    // Also list all authors in the database
    const allAuthors = await Author.find({});
    console.log("\nAll authors in database:", allAuthors);
  } catch (error) {
    console.error("Check error:", error.message);
  }
}

async function fixBooks() {
  try {
    // First create a default author if needed
    const defaultAuthor = await Author.findOne({});
    if (!defaultAuthor) {
      console.log("No authors found in database");
      return;
    }
    await Book.deleteMany({ title: "NoSQL Distilled 2" });

    // Update books with missing/invalid authors
    const result = await Book.updateMany(
      { $or: [{ author: { $exists: false } }, { author: null }] },
      { $set: { author: defaultAuthor._id } }
    );

    console.log(`Updated ${result.modifiedCount} books`);
  } catch (error) {
    console.error("Fix error:", error.message);
  }
}

const typeDefs = `
type User {
  username: String!
  favoriteGenre: String!
  id: ID!
}

type Token {
  value: String!
}
type Address {
  street: String!
  city: String! 
}

type Person {
  name: String!
  phone: String
  address: Address!
  id: ID!
}

type Author {
  name: String!
  id: ID!
  born: Int 
  booksByAuthor: Int
}

type Book {
  title: String!
  published: Int!
 author: Author!
  id: ID!
  genres: [String!]!
}
enum YesNo {
  YES
  NO
}
  type Query {
    personCount: Int!
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    filteredBooks(genre: String!): [Book!]!
    allAuthors: [Author!]!
    allPersons(phone: YesNo): [Person!]!
    findPerson(name: String!): Person
    me: User
  }
    type Mutation {
  addPerson(
    name: String!
    phone: String
    street: String!
    city: String!
  ): Person
  editNumber(
    name: String!
    phone: String!
  ): Person
  addBook(
    title: String!
    author: String!
    published: Int!
    genres: [String]!
  ): Book
   editAuthor(
    name: String!
    born: Int!
  ): Author
  createUser(
    username: String!
    favoriteGenre: String!
  ): User
  login(
    username: String!
    password: String!
  ): Token
   addAsFriend(
    name: String!
  ): User
}
`;

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      return Book.find({}).populate("author");
    },
    filteredBooks: async (root, args, context) => {
      const genre = args.genre;
      console.log(genre);

      return Book.find({ genres: { $in: [genre] } }).populate("author");
    },
    allAuthors: async () => {
      return Author.find({});
    },
    personCount: async () => Person.collection.countDocuments(),
    allPersons: async (root, args) => {
      if (!args.phone) {
        return Person.find({});
      }

      return Person.find({ phone: { $exists: args.phone === "YES" } });
    },
    findPerson: async (root, args) => Person.findOne({ name: args.name }),
    me: (root, args, context) => {
      return context.currentUser;
    },
  },
  Person: {
    address: (root) => {
      return {
        street: root.street,
        city: root.city,
      };
    },
  },
  Author: {
    booksByAuthor: async (root) => {
      //  const author = { name: root.author.name, born: root.author.born };
      //console.log("rootauthor", root._id);

      return Book.countDocuments({ author: root._id });
    },
  },
  //   Book: {
  //     author: (root) => {
  //       return {
  //         name: root.author,
  //       };
  //     },
  //   },
  Mutation: {
    addPerson: async (root, args, context) => {
      const person = new Person({ ...args });
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      try {
        await person.save();
        currentUser.friends = currentUser.friends.concat(person);
        await currentUser.save();
      } catch (error) {
        throw new GraphQLError("Saving person failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      }

      return person;
    },
    editNumber: async (root, args) => {
      const person = await Person.findOne({ name: args.name });
      person.phone = args.phone;
      try {
        await person.save();
      } catch (error) {
        throw new GraphQLError("Saving number failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      }

      return person;
    },
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser;
      console.log(currentUser);

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      let author = await Author.findOne({ name: args.author });
      console.log(author);

      // If author doesn't exist, create new one
      if (!author) {
        author = new Author({
          name: args.author,
          born: 0, // or 0, depending on your preference
        });
        try {
          author = await author.save();
        } catch (error) {
          console.log(error);

          throw new GraphQLError("Saving author failed", {
            extensions: {
              code: "BAD_USER_INPUT",
              invalidArgs: args.author,
              error,
            },
          });
        }
      }
      //  const author = new Author({ name: args.author, born: 0 });
      const book = new Book({ ...args, author: author._id });
      console.log(book);

      try {
        await book.save();
        // Populate the author details before returning
        await book.populate("author");
      } catch (error) {
        throw new GraphQLError("Saving book failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args,
            error,
          },
        });
      }
      return book;
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      const author = await Author.findOne({ name: args.name });
      if (!author) {
        return null;
      }

      author.born = args.born;
      try {
        await author.save();
      } catch (error) {
        console.log(error);

        throw new GraphQLError("editing author failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args,
            error,
          },
        });
      }
      return author;
    },
    createUser: async (root, args) => {
      const user = new User({
        username: args.username,
        favoriteGenre: args.favoriteGenre,
      });

      return user.save().catch((error) => {
        console.log(error);

        throw new GraphQLError("Creating the user failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args,
            error,
          },
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== "secret") {
        throw new GraphQLError("wrong credentials", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
    addAsFriend: async (root, args, { currentUser }) => {
      const isFriend = (person) =>
        currentUser.friends
          .map((f) => f._id.toString())
          .includes(person._id.toString());

      if (!currentUser) {
        throw new GraphQLError("wrong credentials", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const person = await Person.findOne({ name: args.name });
      if (!isFriend(person)) {
        currentUser.friends = currentUser.friends.concat(person);
      }

      await currentUser.save();

      return currentUser;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.startsWith("Bearer ")) {
      const decodedToken = jwt.verify(
        auth.substring(7),
        process.env.JWT_SECRET
      );
      const currentUser = await User.findById(decodedToken.id); //.populate(
      //  "friends"
      // );
      return { currentUser };
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`);
  // checkDatabase3();
});
