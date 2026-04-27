import React from 'react';

// [SOLID: ISP (Interface Segregation Principle)] - Компонент приймає лише ті пропси, які йому потрібні.
const UserList = ({ users, onSelectUser, selectedUserId, currentUsername }) => {
    // [Refactoring: Rename Variable] - filteredList замість просто list
    const filteredList = users.filter(u => u.username !== currentUsername);

    return (
        <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px' }}>
            <h3>Користувачі</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {filteredList.map(user => (
                    <li
                        key={user.id}
                        onClick={() => onSelectUser(user)}
                        style={{
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: selectedUserId === user.id ? '#eee' : 'transparent'
                        }}
                    >
                        {user.username}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default UserList;