
CREATE TABLE IF NOT EXISTS `fitness_metrics` (
  `name` VARCHAR(50) COMMENT 'User name or identifier',
  `record_date` DATE COMMENT 'Date of the health record',
  `weight_kg` FLOAT COMMENT 'Body weight in kilograms',
  `body_fat_pct` FLOAT COMMENT 'Body fat percentage',
  `waist_cm` FLOAT COMMENT 'Waist circumference in cm',
  `resting_heart_rate` INT COMMENT 'Resting heart rate in bpm',
  `sleep_hours` FLOAT COMMENT 'Hours of sleep obtained',
  `steps` INT COMMENT 'Total daily step count',
  `calories_kcal` INT COMMENT 'Total daily calorie intake'
) COMMENT='Daily health and activity tracking logs';

-- Generate data for last 30 days for 4 personas using CTE-like logic or multi-insert
-- Using explicit inserts for compatibility and readability, referencing CURRENT_DATE

INSERT INTO `fitness_metrics` VALUES
-- David (Athlete)
('David', CURRENT_DATE, 78.0, 10.0, 75.0, 55, 8.0, 12050, 3050),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 78.1, 10.1, 75.0, 54, 7.8, 11800, 2900),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 77.9, 9.9, 74.9, 56, 8.2, 13200, 3100),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 78.0, 10.0, 75.0, 55, 7.9, 12500, 3000),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY), 78.2, 10.2, 75.1, 53, 8.5, 11000, 2800),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 78.0, 10.0, 75.0, 55, 8.0, 12100, 3000),
('David', DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 77.8, 9.8, 74.8, 54, 7.5, 14000, 3200),

-- Alice (Health Conscious)
('Alice', CURRENT_DATE, 52.0, 18.0, 62.0, 65, 7.5, 8000, 1800),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 52.1, 18.1, 62.1, 66, 7.2, 7500, 1750),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 51.9, 17.9, 61.9, 64, 7.8, 8500, 1900),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 52.0, 18.0, 62.0, 65, 7.6, 8200, 1850),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY), 52.2, 18.2, 62.2, 63, 7.9, 7800, 1700),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 52.0, 18.0, 62.0, 65, 7.4, 8100, 1800),
('Alice', DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 51.8, 17.8, 61.8, 64, 7.0, 9000, 2000),

-- Bob (Sedentary)
('Bob', CURRENT_DATE, 95.0, 30.0, 105.0, 80, 6.0, 3000, 2500),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 95.2, 30.2, 105.2, 82, 5.8, 2500, 2600),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 94.8, 29.8, 104.8, 79, 6.5, 3500, 2400),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 95.0, 30.0, 105.0, 81, 6.2, 2800, 2550),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY), 95.5, 30.5, 105.5, 83, 5.5, 2200, 2700),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 95.0, 30.0, 105.0, 80, 6.0, 3100, 2450),
('Bob', DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 94.5, 29.5, 104.5, 78, 6.8, 4000, 2300),

-- Charlie (Average)
('Charlie', CURRENT_DATE, 75.0, 22.0, 85.0, 72, 7.0, 5000, 2200),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 75.2, 22.2, 85.2, 73, 6.8, 4500, 2100),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 74.8, 21.8, 84.8, 71, 7.2, 5500, 2300),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 75.0, 22.0, 85.0, 72, 7.0, 5200, 2250),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY), 75.3, 22.3, 85.3, 74, 6.5, 4800, 2150),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 75.0, 22.0, 85.0, 72, 7.1, 5100, 2200),
('Charlie', DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 74.7, 21.7, 84.7, 70, 7.5, 6000, 2400);
