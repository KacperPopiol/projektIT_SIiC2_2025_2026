module.exports = (sequelize, DataTypes) => {
	const File = sequelize.define(
		'File',
		{
			file_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			message_id: {
				type: DataTypes.INTEGER,
				allowNull: true, // Nullable - będzie ustawione po utworzeniu wiadomości
				references: {
					model: 'messages',
					key: 'message_id',
				},
				onDelete: 'CASCADE',
			},
			original_name: {
				type: DataTypes.STRING(500),
				allowNull: false,
			},
			stored_name: {
				type: DataTypes.STRING(500),
				allowNull: false,
				unique: true,
			},
			file_path: {
				type: DataTypes.STRING(1000),
				allowNull: false,
			},
			file_type: {
				type: DataTypes.STRING(100),
				allowNull: false,
				comment: 'MIME type (e.g., image/jpeg, application/pdf)',
			},
			file_size: {
				type: DataTypes.BIGINT,
				allowNull: false,
				comment: 'Rozmiar pliku w bajtach',
			},
			mime_category: {
				type: DataTypes.ENUM('image', 'video', 'document', 'pdf', 'audio'),
				allowNull: false,
				comment: 'Kategoria pliku dla łatwego filtrowania',
			},
			thumbnail_path: {
				type: DataTypes.STRING(1000),
				allowNull: true,
				comment: 'Ścieżka do miniatury (tylko dla obrazów)',
			},
			is_encrypted: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: 'files',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: false, // Nie używamy updated_at
		}
	)

	return File
}

