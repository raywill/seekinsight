
DROP TABLE IF EXISTS "movies_list";
CREATE TABLE "movies_list" (
  "movie_id" integer NOT NULL,
  "title" varchar(150) DEFAULT NULL,
  "genre" varchar(50) DEFAULT NULL,
  "release_year" integer DEFAULT NULL,
  "director" varchar(100) DEFAULT NULL,
  PRIMARY KEY ("movie_id")
);
COMMENT ON TABLE "movies_list" IS 'Movie metadata table';
COMMENT ON COLUMN "movies_list"."movie_id" IS 'Unique movie identifier';
COMMENT ON COLUMN "movies_list"."title" IS 'Movie title';
COMMENT ON COLUMN "movies_list"."genre" IS 'Movie genre';
COMMENT ON COLUMN "movies_list"."release_year" IS 'Year of release';
COMMENT ON COLUMN "movies_list"."director" IS 'Director name';

INSERT INTO "movies_list" VALUES 
(1,'Inception','Sci-Fi',2010,'Christopher Nolan'),
(2,'The Godfather','Crime',1972,'Francis Ford Coppola'),
(3,'Toy Story','Animation',1995,'John Lasseter'),
(4,'Parasite','Thriller',2019,'Bong Joon-ho'),
(5,'The Matrix','Sci-Fi',1999,'Lana Wachowski');

DROP TABLE IF EXISTS "movies_reviews";
CREATE TABLE "movies_reviews" (
  "review_id" integer NOT NULL,
  "movie_id" integer DEFAULT NULL,
  "user_name" varchar(50) DEFAULT NULL,
  "rating" integer DEFAULT NULL,
  "comment" text,
  PRIMARY KEY ("review_id")
);
COMMENT ON TABLE "movies_reviews" IS 'User reviews table';
COMMENT ON COLUMN "movies_reviews"."review_id" IS 'Unique review identifier';
COMMENT ON COLUMN "movies_reviews"."movie_id" IS 'Associated Movie ID';
COMMENT ON COLUMN "movies_reviews"."user_name" IS 'Reviewer username';
COMMENT ON COLUMN "movies_reviews"."rating" IS 'Rating score (1-5)';
COMMENT ON COLUMN "movies_reviews"."comment" IS 'Review text content';

INSERT INTO "movies_reviews" VALUES 
(1,1,'UserA',5,'Mind-blowing concept and visuals.'),
(2,1,'UserB',4,'A bit confusing but great action.'),
(3,2,'UserC',5,'An absolute masterpiece of cinema.'),
(4,3,'UserA',5,'Nostalgic and heartwarming.'),
(5,4,'UserD',5,'Incredible social commentary.'),
(6,5,'UserE',4,'Changed the genre forever.');
