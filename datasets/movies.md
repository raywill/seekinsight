
CREATE TABLE IF NOT EXISTS `movies_list` (
  `movie_id` INT PRIMARY KEY COMMENT 'Unique movie identifier',
  `title` VARCHAR(200) COMMENT 'Title of the movie',
  `genre` VARCHAR(50) COMMENT 'Main genre of the film',
  `release_year` INT COMMENT 'Year the movie was released',
  `director` VARCHAR(100) COMMENT 'Name of the director'
) COMMENT='Database of movies with metadata';

INSERT INTO `movies_list` VALUES
(1, 'Inception', 'Sci-Fi', 2010, 'Christopher Nolan'),
(2, 'The Godfather', 'Crime', 1972, 'Francis Ford Coppola'),
(3, 'Pulp Fiction', 'Crime', 1994, 'Quentin Tarantino'),
(4, 'The Dark Knight', 'Action', 2008, 'Christopher Nolan'),
(5, 'Forrest Gump', 'Drama', 1994, 'Robert Zemeckis'),
(6, 'The Matrix', 'Sci-Fi', 1999, 'Lana Wachowski'),
(7, 'Spirited Away', 'Animation', 2001, 'Hayao Miyazaki'),
(8, 'Parasite', 'Thriller', 2019, 'Bong Joon-ho');

CREATE TABLE IF NOT EXISTS `movies_reviews` (
  `review_id` INT PRIMARY KEY COMMENT 'Unique review identifier',
  `movie_id` INT COMMENT 'ID of the movie being reviewed',
  `user_name` VARCHAR(50) COMMENT 'Name of the reviewer',
  `rating` DECIMAL(3, 1) COMMENT 'Rating given (0.0-5.0)',
  `comment` TEXT COMMENT 'Textual feedback from the user',
  `review_date` DATE COMMENT 'Date of the review'
) COMMENT='User reviews and ratings for movies';

INSERT INTO `movies_reviews` VALUES
(101, 1, 'UserA', 5.0, 'Mind-blowing concept and visuals.', '2023-01-10'),
(102, 1, 'UserB', 4.5, 'A bit confusing but great.', '2023-01-12'),
(103, 2, 'UserC', 5.0, 'A masterpiece of cinema.', '2023-01-15'),
(104, 3, 'UserD', 4.0, 'Classic Tarantino dialogue.', '2023-01-20'),
(105, 4, 'UserA', 5.0, 'Best superhero movie ever.', '2023-02-01'),
(106, 5, 'UserE', 4.5, 'Very touching story.', '2023-02-05'),
(107, 6, 'UserF', 5.0, 'Defined a generation.', '2023-02-10'),
(108, 7, 'UserG', 5.0, 'Beautiful animation.', '2023-02-15'),
(109, 8, 'UserH', 4.8, 'Shocking twists.', '2023-03-01'),
(110, 1, 'UserI', 3.0, 'Too loud for me.', '2023-03-05');
