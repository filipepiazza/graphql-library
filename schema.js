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
  type Subscription {
  personAdded: Person!
  bookAdded: Book!
}    
`;

module.exports = typeDefs;
