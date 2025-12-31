
DROP TABLE IF EXISTS `movies_list`;
CREATE TABLE `movies_list` (
  `movie_id` int NOT NULL COMMENT 'Unique movie identifier',
  `title` varchar(150) DEFAULT NULL COMMENT 'Movie title',
  `genre` varchar(50) DEFAULT NULL COMMENT 'Movie genre',
  `release_year` int DEFAULT NULL COMMENT 'Year of release',
  `director` varchar(100) DEFAULT NULL COMMENT 'Director name',
  PRIMARY KEY (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Movie metadata table';

INSERT INTO `movies_list` VALUES 
(1,'Inception','Sci-Fi',2010,'Christopher Nolan'),
(2,'The Godfather','Crime',1972,'Francis Ford Coppola'),
(3,'Toy Story','Animation',1995,'John Lasseter'),
(4,'Parasite','Thriller',2019,'Bong Joon-ho'),
(5,'The Matrix','Sci-Fi',1999,'Lana Wachowski');

DROP TABLE IF EXISTS `movies_reviews`;
CREATE TABLE `movies_reviews` (
  `review_id` int NOT NULL COMMENT 'Unique review identifier',
  `movie_id` int DEFAULT NULL COMMENT 'Associated Movie ID',
  `user_name` varchar(50) DEFAULT NULL COMMENT 'Reviewer username',
  `rating` int DEFAULT NULL COMMENT 'Rating score (1-5)',
  `comment` text COMMENT 'Review text content',
  PRIMARY KEY (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User reviews table';

INSERT INTO `movies_reviews` VALUES 
(1,1,'UserA',5,'Mind-blowing concept and visuals.'),
(2,1,'UserB',4,'A bit confusing but great action.'),
(3,2,'UserC',5,'An absolute masterpiece of cinema.'),
(4,3,'UserA',5,'Nostalgic and heartwarming.'),
(5,4,'UserD',5,'Incredible social commentary.'),
(6,5,'UserE',4,'Changed the genre forever.');
