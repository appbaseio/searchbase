import React, { useState, useContext, useEffect } from 'react';
import {
  SearchBox,
  SearchContext
} from '@appbaseio/react-native-searchbox';

export default function Search({ setResetPagination }) {
  const [text, setText] = useState('');

  const searchbase = useContext(SearchContext);
  useEffect(() => {
      const searchComponent = searchbase.getComponent('search-component');
    if(searchComponent) {
        // To fetch suggestions
        searchComponent.triggerDefaultQuery();
        // To update results
        // searchComponent.triggerCustomQuery();
    }
 }, [searchbase, text])

  return (
        <SearchBox
          id="search-component"
          dataField={[
            {
              field: 'original_title',
              weight: 1
            },
            {
              field: 'original_title.search',
              weight: 3
            }
          ]}
          onValueSelected={value => {
            setResetPagination(true);
          }}
          value={text}
          onChange={(value, searchComponent) => {
            setText(value);
          }}
        />
  );
};
