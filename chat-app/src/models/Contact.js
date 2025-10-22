module.exports = (sequelize, DataTypes) => {
	const Contact = sequelize.define(
		'Contact',
		{
			contact_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			contact_user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			status: {
				type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
				defaultValue: 'pending',
			},
			requested_by: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
		},
		{
			tableName: 'contacts',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
			indexes: [
				{
					unique: true,
					fields: ['user_id', 'contact_user_id'],
				},
			],
		}
	)

	return Contact
}
